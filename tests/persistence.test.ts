import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { estimateShift } from '@/core/engine';
import { getEmployer } from '@/db/employers';
import { getEnabledHolidayDates, ensureBuiltInHolidays } from '@/db/holidays';
import { loadPayRule } from '@/db/payRules';
import { loadSettings, saveSetting } from '@/db/settings';
import { getActiveShift, listShifts } from '@/db/shifts';
import { pauseShift, resumeShift, startShift, stopShift } from '@/services/shifts';
import { MIN, at, makeEmployer, openTestDb, rule } from './helpers/db';

describe('database persistence and active shift recovery', () => {
  let dir: string;
  let file: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'workearn-test-'));
    file = path.join(dir, 'workearn.db');
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const D = '2026-03-10';

  it('keeps employers, shifts and settings across app restarts', async () => {
    let db = await openTestDb(file);
    const emp = await makeEmployer(db, 'Persistent Ltd', rule({ hourlyRate: 135_000 }));
    const id = await startShift(db, emp, at(D, '09:00'));
    await stopShift(db, id, at(D, '11:00'));
    await saveSetting(db, 'theme', 'dark', 1);
    await db.close();

    db = await openTestDb(file); // "restart": new connection, migrations run again as a no-op
    expect((await getEmployer(db, emp))?.rule.hourlyRate).toBe(135_000);
    const shifts = await listShifts(db);
    expect(shifts).toHaveLength(1);
    expect(shifts[0]).toMatchObject({ id, totalCents: 2700, localDate: D });
    expect((await loadSettings(db)).theme).toBe('dark');
    await db.close();
  });

  it('restores a running shift after the process was killed', async () => {
    let db = await openTestDb(file);
    const emp = await makeEmployer(db);
    await ensureBuiltInHolidays(db, 'BE', 2026, 2026);
    const id = await startShift(db, emp, at(D, '09:00'));
    await db.close(); // the app is gone; the shift was never stopped

    db = await openTestDb(file);
    const active = await getActiveShift(db);
    expect(active).not.toBeNull();
    expect(active).toMatchObject({ id, employerId: emp, startAt: at(D, '09:00'), endAt: null, totalCents: null });

    // two hours later the live number is recomputed from the stored timestamps
    const payRule = (await loadPayRule(db, active!.payRuleId))!;
    const live = estimateShift({
      startAt: active!.startAt,
      now: at(D, '11:00'),
      breaks: active!.breaks,
      rule: payRule,
      holidays: await getEnabledHolidayDates(db),
    });
    expect(live.timeCents).toBe(2400);
    const done = await stopShift(db, id, at(D, '11:00'));
    expect(done.totalCents).toBe(2400);
    await db.close();
  });

  it('restores a paused shift and its open break', async () => {
    let db = await openTestDb(file);
    const emp = await makeEmployer(db);
    const id = await startShift(db, emp, at(D, '09:00'));
    await pauseShift(db, id, at(D, '10:00'));
    await db.close();

    db = await openTestDb(file);
    const active = (await getActiveShift(db))!;
    expect(active.breaks).toHaveLength(1);
    expect(active.breaks[0]).toMatchObject({ startAt: at(D, '10:00'), endAt: null, isPaid: false });
    // while paused the estimate does not grow
    const payRule = (await loadPayRule(db, active.payRuleId))!;
    const holidays = await getEnabledHolidayDates(db);
    const at1030 = estimateShift({ startAt: active.startAt, now: at(D, '10:30'), breaks: active.breaks, rule: payRule, holidays });
    const at1100 = estimateShift({ startAt: active.startAt, now: at(D, '11:00'), breaks: active.breaks, rule: payRule, holidays });
    expect(at1030.timeCents).toBe(1200);
    expect(at1100.timeCents).toBe(1200);
    await resumeShift(db, id, at(D, '11:00'));
    const done = await stopShift(db, id, at(D, '11:30'));
    expect(done.paidMs).toBe(90 * MIN);
    expect(done.totalCents).toBe(1800);
    await db.close();
  });
});
