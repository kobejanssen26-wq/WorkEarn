import { HOLIDAY_NAMES_EN, builtInHolidays } from '@/core/holidays';
import type { HolidayRegion } from '@/core/holidays';
import { ValidationError } from '@/core/errors';
import { isValidDateString } from '@/core/time';

import type { Db, DbExecutor } from './types';

export interface HolidayRecord {
  id: number;
  date: string;
  name: string;
  key: string | null;
  region: string;
  isCustom: boolean;
  isEnabled: boolean;
}

interface HolidayRow {
  id: number;
  date: string;
  name: string;
  holiday_key: string | null;
  region: string;
  is_custom: number;
  is_enabled: number;
}

const toRecord = (r: HolidayRow): HolidayRecord => ({
  id: r.id,
  date: r.date,
  name: r.name,
  key: r.holiday_key,
  region: r.region,
  isCustom: r.is_custom === 1,
  isEnabled: r.is_enabled === 1,
});

/** Dates (local, 'YYYY-MM-DD') that count as public holidays for pay calculations. */
export async function getEnabledHolidayDates(db: DbExecutor): Promise<Set<string>> {
  const rows = await db.all<{ date: string }>('SELECT DISTINCT date FROM holidays WHERE is_enabled = 1');
  return new Set(rows.map((r) => r.date));
}

export async function listHolidays(db: DbExecutor, fromDate?: string, toDate?: string): Promise<HolidayRecord[]> {
  const rows = await db.all<HolidayRow>(
    `SELECT * FROM holidays WHERE date >= ? AND date <= ? ORDER BY date, id`,
    [fromDate ?? '0000-01-01', toDate ?? '9999-12-31'],
  );
  return rows.map(toRecord);
}

/** Insert the built-in holidays of `region` for the given years (existing rows, and the user's enabled flags, are kept). */
export async function ensureBuiltInHolidays(db: DbExecutor, region: HolidayRegion, fromYear: number, toYear: number): Promise<void> {
  if (region === 'NONE') return;
  for (let year = fromYear; year <= toYear; year++) {
    for (const h of builtInHolidays(region, year)) {
      await db.run(
        `INSERT OR IGNORE INTO holidays (date, name, holiday_key, region, is_custom, is_enabled) VALUES (?, ?, ?, ?, 0, 1)`,
        [h.date, HOLIDAY_NAMES_EN[h.key] ?? h.key, h.key, region],
      );
    }
  }
}

/** Replace the built-in holidays by those of another region. Custom holidays are untouched. */
export async function switchHolidayRegion(db: Db, region: HolidayRegion, fromYear: number, toYear: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM holidays WHERE is_custom = 0');
    await ensureBuiltInHolidays(tx, region, fromYear, toYear);
  });
}

export async function addCustomHoliday(db: DbExecutor, date: string, name: string): Promise<number> {
  if (!isValidDateString(date)) throw new ValidationError([{ field: 'date', code: 'date_invalid' }]);
  if (name.trim().length === 0) throw new ValidationError([{ field: 'name', code: 'name_required' }]);
  const res = await db.run(
    `INSERT OR IGNORE INTO holidays (date, name, holiday_key, region, is_custom, is_enabled) VALUES (?, ?, NULL, 'custom', 1, 1)`,
    [date, name.trim()],
  );
  return res.lastInsertRowId;
}

export async function deleteCustomHoliday(db: DbExecutor, id: number): Promise<void> {
  await db.run('DELETE FROM holidays WHERE id = ? AND is_custom = 1', [id]);
}

export async function setHolidayEnabled(db: DbExecutor, id: number, enabled: boolean): Promise<void> {
  await db.run('UPDATE holidays SET is_enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
}
