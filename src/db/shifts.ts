import type { AdjustmentKind } from '@/core/types';

import type { DbExecutor, SqlValue } from './types';

export interface ShiftRecord {
  id: number;
  employerId: number;
  payRuleId: number;
  /** Currency of the pay rule the shift was recorded with. */
  currency: string;
  startAt: number;
  /** null while the shift is running. */
  endAt: number | null;
  localDate: string;
  notes: string | null;
  source: 'live' | 'manual';
  /** Results below are null while the shift is running. */
  paidMs: number | null;
  roundedMs: number | null;
  timeCents: number | null;
  fixedBonusCents: number | null;
  adjustmentsCents: number | null;
  totalCents: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface StoredBreak {
  id: number;
  shiftId: number;
  startAt: number;
  endAt: number | null;
  isPaid: boolean;
  kind: 'pause' | 'manual';
}

export interface StoredAdjustment {
  id: number;
  shiftId: number;
  kind: AdjustmentKind;
  label: string | null;
  amountCents: number;
  createdAt: number;
}

export interface ShiftDetail extends ShiftRecord {
  breaks: StoredBreak[];
  adjustments: StoredAdjustment[];
}

interface ShiftRow {
  id: number;
  employer_id: number;
  pay_rule_id: number;
  currency: string;
  start_at: number;
  end_at: number | null;
  local_date: string;
  notes: string | null;
  source: 'live' | 'manual';
  paid_ms: number | null;
  rounded_ms: number | null;
  time_cents: number | null;
  fixed_bonus_cents: number | null;
  adjustments_cents: number | null;
  total_cents: number | null;
  created_at: number;
  updated_at: number;
}

interface BreakRow {
  id: number;
  shift_id: number;
  start_at: number;
  end_at: number | null;
  is_paid: number;
  kind: 'pause' | 'manual';
}

interface AdjustmentRow {
  id: number;
  shift_id: number;
  kind: AdjustmentKind;
  label: string | null;
  amount_cents: number;
  created_at: number;
}

function toRecord(r: ShiftRow): ShiftRecord {
  return {
    id: r.id,
    employerId: r.employer_id,
    payRuleId: r.pay_rule_id,
    currency: r.currency,
    startAt: r.start_at,
    endAt: r.end_at,
    localDate: r.local_date,
    notes: r.notes,
    source: r.source,
    paidMs: r.paid_ms,
    roundedMs: r.rounded_ms,
    timeCents: r.time_cents,
    fixedBonusCents: r.fixed_bonus_cents,
    adjustmentsCents: r.adjustments_cents,
    totalCents: r.total_cents,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const toBreak = (r: BreakRow): StoredBreak => ({
  id: r.id,
  shiftId: r.shift_id,
  startAt: r.start_at,
  endAt: r.end_at,
  isPaid: r.is_paid === 1,
  kind: r.kind,
});

const toAdjustment = (r: AdjustmentRow): StoredAdjustment => ({
  id: r.id,
  shiftId: r.shift_id,
  kind: r.kind,
  label: r.label,
  amountCents: r.amount_cents,
  createdAt: r.created_at,
});

const SHIFT_SELECT = 'SELECT s.*, p.currency AS currency FROM shifts s JOIN pay_rules p ON p.id = s.pay_rule_id';

export async function getShiftRecord(db: DbExecutor, id: number): Promise<ShiftRecord | null> {
  const row = await db.get<ShiftRow>(`${SHIFT_SELECT} WHERE s.id = ?`, [id]);
  return row ? toRecord(row) : null;
}

export async function getShiftDetail(db: DbExecutor, id: number): Promise<ShiftDetail | null> {
  const record = await getShiftRecord(db, id);
  if (!record) return null;
  const breaks = await db.all<BreakRow>('SELECT * FROM breaks WHERE shift_id = ? ORDER BY start_at, id', [id]);
  const adjustments = await db.all<AdjustmentRow>('SELECT * FROM earnings_adjustments WHERE shift_id = ? ORDER BY created_at, id', [id]);
  return { ...record, breaks: breaks.map(toBreak), adjustments: adjustments.map(toAdjustment) };
}

/** The running shift, if any (at most one can exist, enforced by a unique partial index). */
export async function getActiveShift(db: DbExecutor): Promise<ShiftDetail | null> {
  const row = await db.get<{ id: number }>('SELECT id FROM shifts WHERE end_at IS NULL');
  return row ? getShiftDetail(db, row.id) : null;
}

export interface ShiftFilter {
  /** Inclusive local dates 'YYYY-MM-DD' (by shift start date). */
  fromDate?: string;
  toDate?: string;
  employerId?: number | null;
  /** Default false: only finished shifts. */
  includeActive?: boolean;
  order?: 'asc' | 'desc';
  limit?: number;
}

export async function listShifts(db: DbExecutor, filter: ShiftFilter = {}): Promise<ShiftRecord[]> {
  const where: string[] = [];
  const params: SqlValue[] = [];
  if (!filter.includeActive) where.push('s.end_at IS NOT NULL');
  if (filter.fromDate) {
    where.push('s.local_date >= ?');
    params.push(filter.fromDate);
  }
  if (filter.toDate) {
    where.push('s.local_date <= ?');
    params.push(filter.toDate);
  }
  if (filter.employerId !== undefined && filter.employerId !== null) {
    where.push('s.employer_id = ?');
    params.push(filter.employerId);
  }
  const dir = filter.order === 'asc' ? 'ASC' : 'DESC';
  const sql = `${SHIFT_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY s.start_at ${dir}, s.id ${dir} ${
    filter.limit ? `LIMIT ${Math.floor(filter.limit)}` : ''
  }`;
  const rows = await db.all<ShiftRow>(sql, params);
  return rows.map(toRecord);
}

export interface ShiftResultColumns {
  paidMs: number;
  roundedMs: number;
  timeCents: number;
  fixedBonusCents: number;
  adjustmentsCents: number;
  totalCents: number;
}

export async function insertShiftRow(
  db: DbExecutor,
  v: {
    employerId: number;
    payRuleId: number;
    startAt: number;
    endAt: number | null;
    localDate: string;
    notes: string | null;
    source: 'live' | 'manual';
    results: ShiftResultColumns | null;
    now: number;
  },
): Promise<number> {
  const r = v.results;
  const res = await db.run(
    `INSERT INTO shifts (employer_id, pay_rule_id, start_at, end_at, local_date, notes, source,
       paid_ms, rounded_ms, time_cents, fixed_bonus_cents, adjustments_cents, total_cents, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      v.employerId,
      v.payRuleId,
      v.startAt,
      v.endAt,
      v.localDate,
      v.notes,
      v.source,
      r?.paidMs ?? null,
      r?.roundedMs ?? null,
      r?.timeCents ?? null,
      r?.fixedBonusCents ?? null,
      r?.adjustmentsCents ?? null,
      r?.totalCents ?? null,
      v.now,
      v.now,
    ],
  );
  return res.lastInsertRowId;
}

export async function updateShiftRow(
  db: DbExecutor,
  id: number,
  v: {
    employerId: number;
    payRuleId: number;
    startAt: number;
    endAt: number | null;
    localDate: string;
    notes: string | null;
    results: ShiftResultColumns | null;
    now: number;
  },
): Promise<void> {
  const r = v.results;
  await db.run(
    `UPDATE shifts SET employer_id = ?, pay_rule_id = ?, start_at = ?, end_at = ?, local_date = ?, notes = ?,
       paid_ms = ?, rounded_ms = ?, time_cents = ?, fixed_bonus_cents = ?, adjustments_cents = ?, total_cents = ?, updated_at = ?
     WHERE id = ?`,
    [
      v.employerId,
      v.payRuleId,
      v.startAt,
      v.endAt,
      v.localDate,
      v.notes,
      r?.paidMs ?? null,
      r?.roundedMs ?? null,
      r?.timeCents ?? null,
      r?.fixedBonusCents ?? null,
      r?.adjustmentsCents ?? null,
      r?.totalCents ?? null,
      v.now,
      id,
    ],
  );
}

export async function replaceBreaks(
  db: DbExecutor,
  shiftId: number,
  breaks: readonly { startAt: number; endAt: number | null; isPaid: boolean; kind?: 'pause' | 'manual' }[],
): Promise<void> {
  await db.run('DELETE FROM breaks WHERE shift_id = ?', [shiftId]);
  for (const b of breaks) {
    await db.run('INSERT INTO breaks (shift_id, start_at, end_at, is_paid, kind) VALUES (?, ?, ?, ?, ?)', [
      shiftId,
      b.startAt,
      b.endAt,
      b.isPaid ? 1 : 0,
      b.kind ?? 'manual',
    ]);
  }
}

export async function replaceAdjustments(
  db: DbExecutor,
  shiftId: number,
  adjustments: readonly { kind: AdjustmentKind; label?: string | null; amountCents: number }[],
  now: number,
): Promise<void> {
  await db.run('DELETE FROM earnings_adjustments WHERE shift_id = ?', [shiftId]);
  for (const a of adjustments) {
    await db.run('INSERT INTO earnings_adjustments (shift_id, kind, label, amount_cents, created_at) VALUES (?, ?, ?, ?, ?)', [
      shiftId,
      a.kind,
      a.label?.trim() || null,
      a.amountCents,
      now,
    ]);
  }
}

export async function deleteShiftRow(db: DbExecutor, id: number): Promise<boolean> {
  const res = await db.run('DELETE FROM shifts WHERE id = ?', [id]);
  return res.changes > 0;
}

export interface RangeTotals {
  cents: number;
  ms: number;
  shifts: number;
}

/** Totals of finished shifts whose local start date lies in [fromDate, toDate], optionally for one currency only. */
export async function getTotalsForRange(db: DbExecutor, fromDate: string, toDate: string, currency?: string): Promise<RangeTotals> {
  const row = await db.get<{ cents: number; ms: number; n: number }>(
    `SELECT COALESCE(SUM(s.total_cents), 0) AS cents, COALESCE(SUM(s.rounded_ms), 0) AS ms, COUNT(*) AS n
     FROM shifts s JOIN pay_rules p ON p.id = s.pay_rule_id
     WHERE s.end_at IS NOT NULL AND s.local_date >= ? AND s.local_date <= ? ${currency ? 'AND p.currency = ?' : ''}`,
    currency ? [fromDate, toDate, currency] : [fromDate, toDate],
  );
  return { cents: row?.cents ?? 0, ms: row?.ms ?? 0, shifts: row?.n ?? 0 };
}
