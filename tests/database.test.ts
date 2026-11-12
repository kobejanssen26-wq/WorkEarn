import { createEmployer, deleteEmployer, getEmployer, listEmployers, setEmployerArchived, updateEmployer } from '@/db/employers';
import { addCustomHoliday, ensureBuiltInHolidays, getEnabledHolidayDates, listHolidays, setHolidayEnabled, switchHolidayRegion } from '@/db/holidays';
import { LATEST_SCHEMA_VERSION, getSchemaVersion, migrate } from '@/db/migrations';
import { DEFAULT_SETTINGS, loadSettings, saveSetting } from '@/db/settings';
import { getActiveShift } from '@/db/shifts';
import { startShift, stopShift } from '@/services/shifts';
import { seedHolidays } from '@/services/data';
import { HOUR, T0, at, makeEmployer, openTestDb, rule } from './helpers/db';

describe('schema and migrations', () => {
  it('creates all tables, indexes and the schema version', async () => {
    const db = await openTestDb();
    const tables = (await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")).map((t) => t.name);
    expect(tables).toEqual(
      expect.arrayContaining(['employers', 'pay_rules', 'pay_rule_weekday_rates', 'pay_rule_bonuses', 'pay_rule_fixed_bonuses', 'shifts', 'breaks', 'earnings_adjustments', 'holidays', 'app_settings']),
    );
    const indexes = (await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'index'")).map((i) => i.name);
    expect(indexes).toEqual(expect.arrayContaining(['idx_shifts_single_active', 'idx_shifts_start', 'idx_shifts_employer_date', 'idx_breaks_single_open']));
    expect(await getSchemaVersion(db)).toBe(LATEST_SCHEMA_VERSION);
  });

  it('is idempotent and refuses a database from a newer app', async () => {
    const db = await openTestDb();
    expect(await migrate(db)).toEqual({ from: LATEST_SCHEMA_VERSION, to: LATEST_SCHEMA_VERSION });
    await db.exec(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION + 1}`);
    await expect(migrate(db)).rejects.toThrow(/newer than supported/);
  });

  it('enforces foreign keys and check constraints', async () => {
    const db = await openTestDb();
    await expect(
      db.run(`INSERT INTO shifts (employer_id, pay_rule_id, start_at, end_at, local_date, created_at, updated_at, total_cents) VALUES (999, 999, 1, 2, '2026-01-01', 1, 1, 0)`),
    ).rejects.toThrow();
    const emp = await makeEmployer(db);
    const ruleRow = await db.get<{ id: number }>('SELECT id FROM pay_rules WHERE employer_id = ?', [emp]);
    // a finished shift must carry results, a running shift must not
    await expect(
      db.run(`INSERT INTO shifts (employer_id, pay_rule_id, start_at, end_at, local_date, created_at, updated_at) VALUES (?, ?, 1, 2, '2026-01-01', 1, 1)`, [emp, ruleRow!.id]),
    ).rejects.toThrow();
    await expect(db.run(`INSERT INTO employers (name, created_at, updated_at) VALUES ('  ', 1, 1)`)).rejects.toThrow();
  });

  it('allows only one running shift at the database level', async () => {
    const db = await openTestDb();
    const a = await makeEmployer(db, 'A');
    const b = await makeEmployer(db, 'B');
    await startShift(db, a, T0 + HOUR);
    await expect(startShift(db, b, T0 + 2 * HOUR)).rejects.toThrow(/shift_already_active/);
    const ruleRow = await db.get<{ id: number }>('SELECT id FROM pay_rules WHERE employer_id = ?', [b]);
    await expect(
      db.run(`INSERT INTO shifts (employer_id, pay_rule_id, start_at, local_date, created_at, updated_at) VALUES (?, ?, 5, '2026-01-01', 1, 1)`, [b, ruleRow!.id]),
    ).rejects.toThrow(); // unique partial index
  });
});

describe('transactions', () => {
  it('rolls back everything when a step fails', async () => {
    const db = await openTestDb();
    await expect(
      db.transaction(async (tx) => {
        await tx.run(`INSERT INTO employers (name, created_at, updated_at) VALUES ('Temp', 1, 1)`);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await db.all('SELECT * FROM employers')).toHaveLength(0);
    // the connection still works afterwards
    await db.run(`INSERT INTO employers (name, created_at, updated_at) VALUES ('Ok', 1, 1)`);
    expect(await db.all('SELECT * FROM employers')).toHaveLength(1);
  });

  it('serialises concurrent callers', async () => {
    const db = await openTestDb();
    await db.exec('CREATE TABLE counter (n INTEGER)');
    await db.run('INSERT INTO counter VALUES (0)');
    await Promise.all(
      Array.from({ length: 25 }, () =>
        db.transaction(async (tx) => {
          const row = await tx.get<{ n: number }>('SELECT n FROM counter');
          await tx.run('UPDATE counter SET n = ?', [(row?.n ?? 0) + 1]);
        }),
      ),
    );
    expect((await db.get<{ n: number }>('SELECT n FROM counter'))?.n).toBe(25);
  });
});

describe('employers and pay rule versions', () => {
  it('stores a complete pay rule and reads it back', async () => {
    const db = await openTestDb();
    const full = rule({
      hourlyRate: 123_456,
      weekdayRates: { 0: 130_000, 4: 140_000 },
      saturday: { valueType: 'percent', value: 5000, mode: 'add' },
      sunday: { valueType: 'amount', value: 200_000, mode: 'replace' },
      holiday: { valueType: 'percent', value: 10_000, mode: 'add' },
      customBonuses: [{ name: 'Night', valueType: 'percent', value: 2000, mode: 'add', weekdayMask: 0b1111111, startMinute: 1320, endMinute: 360 }],
      fixedBonuses: [{ name: 'Opening', amountCents: 500, condition: 'always' }],
      intervalMinutes: 15,
      roundingMode: 'down',
    });
    const id = await createEmployer(db, { name: '  Café Zuid ', color: '#0EA5E9', notes: 'Weekend job' }, full, T0);
    const loaded = await getEmployer(db, id);
    expect(loaded?.name).toBe('Café Zuid');
    expect(loaded?.notes).toBe('Weekend job');
    expect(loaded?.currency).toBe('EUR');
    expect(loaded?.rule).toMatchObject({
      hourlyRate: 123_456,
      weekdayRates: { 0: 130_000, 4: 140_000 },
      saturday: { valueType: 'percent', value: 5000, mode: 'add' },
      sunday: { valueType: 'amount', value: 200_000, mode: 'replace' },
      holiday: { valueType: 'percent', value: 10_000, mode: 'add' },
      intervalMinutes: 15,
      roundingMode: 'down',
    });
    expect(loaded?.rule.customBonuses[0]).toMatchObject({ name: 'Night', startMinute: 1320, endMinute: 360, weekdayMask: 127 });
    expect(loaded?.rule.fixedBonuses[0]).toMatchObject({ name: 'Opening', amountCents: 500, condition: 'always' });
  });

  it('rejects invalid employers and pay rules', async () => {
    const db = await openTestDb();
    await expect(createEmployer(db, { name: ' ', color: '#10B981' }, rule(), T0)).rejects.toThrow(/name_required/);
    await expect(createEmployer(db, { name: 'X', color: 'green' }, rule(), T0)).rejects.toThrow(/color_invalid/);
    await expect(createEmployer(db, { name: 'X', color: '#10B981' }, rule({ hourlyRate: -5 }), T0)).rejects.toThrow(/rate_invalid/);
    expect(await listEmployers(db)).toHaveLength(0); // nothing half-created
  });

  it('edits an unused pay rule in place but versions a rule that shifts already use', async () => {
    const db = await openTestDb();
    const id = await makeEmployer(db, 'Shop', rule({ hourlyRate: 120_000 }));
    const rulesCount = async () => (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM pay_rules WHERE employer_id = ?', [id]))!.n;

    await updateEmployer(db, id, { name: 'Shop', color: '#10B981' }, rule({ hourlyRate: 125_000 }), T0 + 1);
    expect(await rulesCount()).toBe(1); // unused -> edited in place
    expect((await getEmployer(db, id))?.rule.hourlyRate).toBe(125_000);

    const shiftId = await startShift(db, id, at('2026-03-10', '09:00'));
    await stopShift(db, shiftId, at('2026-03-10', '10:00'));
    await updateEmployer(db, id, { name: 'Shop', color: '#10B981' }, rule({ hourlyRate: 150_000 }), T0 + 2);
    expect(await rulesCount()).toBe(2); // used -> new version
    await updateEmployer(db, id, { name: 'Shop renamed', color: '#10B981' }, rule({ hourlyRate: 150_000 }), T0 + 3);
    expect(await rulesCount()).toBe(2); // unchanged rule -> no new version

    const current = await getEmployer(db, id);
    expect(current?.rule.hourlyRate).toBe(150_000);
    expect(current?.rule.version).toBe(2);
    const old = await db.get<{ hourly_rate: number }>('SELECT p.hourly_rate FROM shifts s JOIN pay_rules p ON p.id = s.pay_rule_id WHERE s.id = ?', [shiftId]);
    expect(old?.hourly_rate).toBe(125_000); // historical shift keeps its original configuration
  });

  it('archives and deletes employers (deleting removes their shifts)', async () => {
    const db = await openTestDb();
    const a = await makeEmployer(db, 'A');
    const b = await makeEmployer(db, 'B');
    const shiftId = await startShift(db, a, at('2026-03-10', '09:00'));
    await stopShift(db, shiftId, at('2026-03-10', '10:00'));
    await setEmployerArchived(db, b, true, T0);
    expect((await listEmployers(db)).map((e) => e.name)).toEqual(['A']);
    expect((await listEmployers(db, { includeArchived: true })).map((e) => e.name)).toEqual(['A', 'B']);
    await deleteEmployer(db, a);
    expect(await db.all('SELECT * FROM shifts')).toHaveLength(0);
    expect(await db.all('SELECT * FROM pay_rules WHERE employer_id = ?', [a])).toHaveLength(0);
    expect(await getActiveShift(db)).toBeNull();
  });
});

describe('settings', () => {
  it('returns defaults, persists changes and ignores corrupt values', async () => {
    const db = await openTestDb();
    expect(await loadSettings(db)).toEqual(DEFAULT_SETTINGS);
    await saveSetting(db, 'theme', 'dark', T0);
    await saveSetting(db, 'language', 'nl', T0);
    await saveSetting(db, 'keepAwake', true, T0);
    await saveSetting(db, 'weekStart', 6, T0);
    await saveSetting(db, 'lastEmployerId', 7, T0);
    await saveSetting(db, 'theme', 'light', T0 + 1); // upsert
    expect(await loadSettings(db)).toMatchObject({ theme: 'light', language: 'nl', keepAwake: true, weekStart: 6, lastEmployerId: 7 });
    await db.run(`INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('theme', 'neon', 1), ('currency', 'XXX', 1), ('mystery', '1', 1)`);
    const s = await loadSettings(db);
    expect(s.theme).toBe('system');
    expect(s.currency).toBe('EUR');
    await saveSetting(db, 'lastEmployerId', null, T0);
    expect((await loadSettings(db)).lastEmployerId).toBeNull();
  });
});

describe('holidays', () => {
  it('seeds built-in holidays idempotently and switches region', async () => {
    const db = await openTestDb();
    await ensureBuiltInHolidays(db, 'BE', 2026, 2027);
    await ensureBuiltInHolidays(db, 'BE', 2026, 2027);
    expect(await listHolidays(db, '2026-01-01', '2026-12-31')).toHaveLength(10);
    expect((await getEnabledHolidayDates(db)).has('2026-05-01')).toBe(true);

    const labour = (await listHolidays(db, '2026-05-01', '2026-05-01'))[0]!;
    await setHolidayEnabled(db, labour.id, false);
    await ensureBuiltInHolidays(db, 'BE', 2026, 2027); // keeps the user's choice
    expect((await getEnabledHolidayDates(db)).has('2026-05-01')).toBe(false);

    await addCustomHoliday(db, '2026-09-27', 'Company day');
    await expect(addCustomHoliday(db, '2026-13-01', 'Bad')).rejects.toThrow(/date_invalid/);
    await switchHolidayRegion(db, 'NL', 2026, 2026);
    const dates = await getEnabledHolidayDates(db);
    expect(dates.has('2026-04-27')).toBe(true); // Koningsdag
    expect(dates.has('2026-07-21')).toBe(false); // Belgian National Day gone
    expect(dates.has('2026-09-27')).toBe(true); // custom holiday survives
  });

  it('seeds the holiday window once and skips all writes on later launches', async () => {
    const db = await openTestDb();
    await seedHolidays(db, 'BE', 2026);
    expect((await listHolidays(db, '2024-01-01', '2031-12-31')).length).toBe(80); // 8 years x 10 holidays
    const run = jest.spyOn(db, 'run');
    await seedHolidays(db, 'BE', 2026);
    expect(run).not.toHaveBeenCalled();
    await seedHolidays(db, 'BE', 2027); // window moved forward: only the missing year is added
    expect((await listHolidays(db, '2025-01-01', '2032-12-31')).length).toBe(80);
  });
});
