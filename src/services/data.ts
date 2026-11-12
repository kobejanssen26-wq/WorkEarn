/** Whole-database operations: reset and export queries. */

import type { ExportShift } from '@/core/csv';
import { ensureBuiltInHolidays } from '@/db/holidays';
import { listEmployers } from '@/db/employers';
import { listShifts } from '@/db/shifts';
import type { Db, DbExecutor } from '@/db/types';
import type { HolidayRegion } from '@/core/holidays';

/** Seed the built-in holidays for a window of years around "now". */
export async function seedHolidays(db: DbExecutor, region: HolidayRegion, nowYear: number): Promise<void> {
  await ensureBuiltInHolidays(db, region, nowYear - 2, nowYear + 5);
}

/** Permanently delete everything the app stores, including settings. */
export async function resetAllData(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    for (const table of ['earnings_adjustments', 'breaks', 'shifts', 'pay_rule_fixed_bonuses', 'pay_rule_bonuses', 'pay_rule_weekday_rates', 'pay_rules', 'employers', 'holidays', 'app_settings']) {
      await tx.run(`DELETE FROM ${table}`);
    }
    await tx.run(`DELETE FROM sqlite_sequence`);
  });
}

export interface ExportFilter {
  fromDate?: string;
  toDate?: string;
  employerId?: number | null;
}

/** Finished shifts with their break and adjustment totals, oldest first, ready for CSV. */
export async function loadExportRows(db: DbExecutor, filter: ExportFilter): Promise<ExportShift[]> {
  const shifts = await listShifts(db, { ...filter, order: 'asc' });
  if (shifts.length === 0) return [];
  const employers = new Map((await listEmployers(db, { includeArchived: true })).map((e) => [e.id, e]));
  const breakRows = await db.all<{ shift_id: number; unpaid: number }>(
    `SELECT shift_id, COALESCE(SUM(CASE WHEN is_paid = 0 THEN end_at - start_at ELSE 0 END), 0) AS unpaid
     FROM breaks WHERE end_at IS NOT NULL GROUP BY shift_id`,
  );
  const unpaidByShift = new Map(breakRows.map((r) => [r.shift_id, r.unpaid]));
  const adjRows = await db.all<{ shift_id: number; kind: string; total: number }>(
    'SELECT shift_id, kind, SUM(amount_cents) AS total FROM earnings_adjustments GROUP BY shift_id, kind',
  );
  const tips = new Map<number, number>();
  const extras = new Map<number, number>();
  for (const a of adjRows) (a.kind === 'tip' ? tips : extras).set(a.shift_id, a.total);

  const rows: ExportShift[] = [];
  for (const s of shifts) {
    if (s.endAt === null) continue;
    rows.push({
      startAt: s.startAt,
      endAt: s.endAt,
      employerName: employers.get(s.employerId)?.name ?? '',
      currency: s.currency,
      unpaidBreakMs: unpaidByShift.get(s.id) ?? 0,
      paidMs: s.paidMs ?? 0,
      roundedMs: s.roundedMs ?? 0,
      timeCents: s.timeCents ?? 0,
      fixedBonusCents: s.fixedBonusCents ?? 0,
      tipsCents: tips.get(s.id) ?? 0,
      extrasCents: extras.get(s.id) ?? 0,
      totalCents: s.totalCents ?? 0,
      notes: s.notes,
    });
  }
  return rows;
}
