/**
 * Shift use-cases. All state lives in SQLite, so a running shift survives the app being closed or
 * killed: on the next launch `getActiveShift` simply finds the unfinished row again. Time is always
 * passed in (`now`), never read from a global clock, which keeps everything deterministic and testable.
 */

import { calculateShift } from '@/core/engine';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors';
import { MAX_ADJUSTMENT_CENTS, validateShiftTimes } from '@/core/payRule';
import type { Issue } from '@/core/payRule';
import { toLocalDateString } from '@/core/time';
import type { AdjustmentKind } from '@/core/types';
import { getEnabledHolidayDates } from '@/db/holidays';
import { getCurrentPayRuleId, loadPayRule } from '@/db/payRules';
import {
  deleteShiftRow,
  getShiftDetail,
  insertShiftRow,
  replaceAdjustments,
  replaceBreaks,
  updateShiftRow,
} from '@/db/shifts';
import type { ShiftDetail, ShiftResultColumns } from '@/db/shifts';
import type { Db, DbExecutor } from '@/db/types';

export interface ShiftInput {
  /** Omit to create a new (manual) shift. */
  id?: number;
  employerId: number;
  startAt: number;
  endAt: number;
  breaks: { startAt: number; endAt: number; isPaid: boolean }[];
  adjustments: { kind: AdjustmentKind; label?: string | null; amountCents: number }[];
  notes?: string | null;
  /** Re-price an existing shift with the employer's CURRENT pay rules instead of the ones it was recorded with. */
  useCurrentRule?: boolean;
}

async function computeResults(
  tx: DbExecutor,
  args: {
    payRuleId: number;
    startAt: number;
    endAt: number;
    breaks: readonly { startAt: number; endAt: number; isPaid: boolean }[];
    adjustments: readonly { kind: AdjustmentKind; amountCents: number }[];
  },
): Promise<ShiftResultColumns> {
  const rule = await loadPayRule(tx, args.payRuleId);
  if (!rule) throw new NotFoundError('pay_rule_not_found');
  const holidays = await getEnabledHolidayDates(tx);
  const calc = calculateShift({
    startAt: args.startAt,
    endAt: args.endAt,
    breaks: args.breaks,
    rule,
    holidays,
    adjustments: args.adjustments,
  });
  return {
    paidMs: calc.paidMs,
    roundedMs: calc.roundedMs,
    timeCents: calc.timeCents,
    fixedBonusCents: calc.fixedBonusCents,
    adjustmentsCents: calc.adjustmentsCents,
    totalCents: calc.totalCents,
  };
}

function validateAdjustments(adjustments: ShiftInput['adjustments']): Issue[] {
  const issues: Issue[] = [];
  adjustments.forEach((a, i) => {
    if (!Number.isInteger(a.amountCents) || Math.abs(a.amountCents) > MAX_ADJUSTMENT_CENTS) {
      issues.push({ field: `adjustments.${i}`, code: 'amount_invalid' });
    } else if (a.kind === 'tip' && a.amountCents < 0) {
      issues.push({ field: `adjustments.${i}`, code: 'amount_invalid' });
    }
  });
  return issues;
}

/* ---------------------------- live shift ---------------------------- */

/** Start a shift now (or at `startAt` in the past). Only one shift can run at a time. */
export async function startShift(db: Db, employerId: number, now: number, startAt: number = now): Promise<number> {
  return db.transaction(async (tx) => {
    const active = await tx.get<{ id: number }>('SELECT id FROM shifts WHERE end_at IS NULL');
    if (active) throw new ConflictError('shift_already_active');
    const payRuleId = await getCurrentPayRuleId(tx, employerId);
    if (payRuleId === null) throw new NotFoundError('employer_not_found');
    if (startAt > now) throw new ValidationError([{ field: 'startAt', code: 'start_in_future' }]);
    return insertShiftRow(tx, {
      employerId,
      payRuleId,
      startAt,
      endAt: null,
      localDate: toLocalDateString(startAt),
      notes: null,
      source: 'live',
      results: null,
      now,
    });
  });
}

async function requireActive(tx: DbExecutor, shiftId: number): Promise<ShiftDetail> {
  const shift = await getShiftDetail(tx, shiftId);
  if (!shift) throw new NotFoundError('shift_not_found');
  if (shift.endAt !== null) throw new ConflictError('shift_not_active');
  return shift;
}

/** Pause the running shift. The pause is an (unpaid by default) break that stays open until resumed or stopped. */
export async function pauseShift(db: Db, shiftId: number, now: number, isPaid = false): Promise<void> {
  await db.transaction(async (tx) => {
    const shift = await requireActive(tx, shiftId);
    if (shift.breaks.some((b) => b.endAt === null)) throw new ConflictError('already_paused');
    await tx.run('INSERT INTO breaks (shift_id, start_at, end_at, is_paid, kind) VALUES (?, ?, NULL, ?, ?)', [
      shiftId,
      Math.max(now, shift.startAt),
      isPaid ? 1 : 0,
      'pause',
    ]);
  });
}

export async function resumeShift(db: Db, shiftId: number, now: number): Promise<void> {
  await db.transaction(async (tx) => {
    const shift = await requireActive(tx, shiftId);
    const open = shift.breaks.find((b) => b.endAt === null);
    if (!open) throw new ConflictError('not_paused');
    await tx.run('UPDATE breaks SET end_at = MAX(?, start_at) WHERE id = ?', [now, open.id]);
  });
}

/** Switch the currently open pause between paid and unpaid. */
export async function setOpenBreakPaid(db: Db, shiftId: number, isPaid: boolean): Promise<void> {
  await db.run('UPDATE breaks SET is_paid = ? WHERE shift_id = ? AND end_at IS NULL', [isPaid ? 1 : 0, shiftId]);
}

/** Finish the running shift: closes an open pause, applies the employer's rounding and stores the final earnings. */
export async function stopShift(db: Db, shiftId: number, now: number): Promise<ShiftDetail> {
  return db.transaction(async (tx) => {
    const shift = await requireActive(tx, shiftId);
    const endAt = Math.max(now, shift.startAt);
    await tx.run('UPDATE breaks SET end_at = MAX(?, start_at) WHERE shift_id = ? AND end_at IS NULL', [endAt, shiftId]);
    const closed = await getShiftDetail(tx, shiftId);
    if (!closed) throw new NotFoundError('shift_not_found');
    const breaks = closed.breaks.map((b) => ({ startAt: b.startAt, endAt: b.endAt ?? endAt, isPaid: b.isPaid }));
    const results = await computeResults(tx, {
      payRuleId: closed.payRuleId,
      startAt: closed.startAt,
      endAt,
      breaks,
      adjustments: closed.adjustments,
    });
    await updateShiftRow(tx, shiftId, {
      employerId: closed.employerId,
      payRuleId: closed.payRuleId,
      startAt: closed.startAt,
      endAt,
      localDate: closed.localDate,
      notes: closed.notes,
      results,
      now,
    });
    const done = await getShiftDetail(tx, shiftId);
    if (!done) throw new NotFoundError('shift_not_found');
    return done;
  });
}

/** Throw away a running shift (accidental start). */
export async function discardActiveShift(db: Db, shiftId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await requireActive(tx, shiftId);
    await deleteShiftRow(tx, shiftId);
  });
}

/** Correct the start of the running shift ("I forgot to start it 20 minutes ago"). */
export async function setActiveShiftStart(db: Db, shiftId: number, newStartAt: number, now: number): Promise<void> {
  await db.transaction(async (tx) => {
    const shift = await requireActive(tx, shiftId);
    if (newStartAt > now) throw new ValidationError([{ field: 'startAt', code: 'start_in_future' }]);
    const firstBreak = shift.breaks[0];
    if (firstBreak && newStartAt > firstBreak.startAt) throw new ValidationError([{ field: 'startAt', code: 'start_after_break' }]);
    await tx.run('UPDATE shifts SET start_at = ?, local_date = ?, updated_at = ? WHERE id = ?', [
      newStartAt,
      toLocalDateString(newStartAt),
      now,
      shiftId,
    ]);
  });
}

/* --------------------------- finished shifts --------------------------- */

/** Create or edit a finished shift (history editing / manual entry). Everything is saved atomically. */
export async function saveShift(db: Db, input: ShiftInput, now: number): Promise<number> {
  const issues = [...validateShiftTimes(input), ...validateAdjustments(input.adjustments)];
  if (issues.length > 0) throw new ValidationError(issues);

  return db.transaction(async (tx) => {
    const employerRule = await getCurrentPayRuleId(tx, input.employerId);
    if (employerRule === null) throw new NotFoundError('employer_not_found');

    let payRuleId = employerRule;
    let existing: ShiftDetail | null = null;
    if (input.id !== undefined) {
      existing = await getShiftDetail(tx, input.id);
      if (!existing) throw new NotFoundError('shift_not_found');
      if (existing.endAt === null) throw new ConflictError('shift_active');
      // Historical shifts keep the pay rules they were recorded with unless the employer changes
      // or the user explicitly asks to re-price with the current rules.
      if (existing.employerId === input.employerId && !input.useCurrentRule) payRuleId = existing.payRuleId;
    }

    const results = await computeResults(tx, {
      payRuleId,
      startAt: input.startAt,
      endAt: input.endAt,
      breaks: input.breaks,
      adjustments: input.adjustments,
    });
    const notes = input.notes?.trim() || null;
    let id: number;
    if (existing) {
      id = existing.id;
      await updateShiftRow(tx, id, {
        employerId: input.employerId,
        payRuleId,
        startAt: input.startAt,
        endAt: input.endAt,
        localDate: toLocalDateString(input.startAt),
        notes,
        results,
        now,
      });
    } else {
      id = await insertShiftRow(tx, {
        employerId: input.employerId,
        payRuleId,
        startAt: input.startAt,
        endAt: input.endAt,
        localDate: toLocalDateString(input.startAt),
        notes,
        source: 'manual',
        results,
        now,
      });
    }
    await replaceBreaks(
      tx,
      id,
      input.breaks.map((b) => ({ ...b, kind: 'manual' as const })),
    );
    await replaceAdjustments(tx, id, input.adjustments, now);
    return id;
  });
}

export async function deleteShift(db: Db, shiftId: number): Promise<void> {
  const removed = await deleteShiftRow(db, shiftId);
  if (!removed) throw new NotFoundError('shift_not_found');
}

/** Add a tip / extra amount to a shift (running or finished). Finished shifts are re-totalled. */
export async function addAdjustment(
  db: Db,
  shiftId: number,
  adjustment: { kind: AdjustmentKind; label?: string | null; amountCents: number },
  now: number,
): Promise<void> {
  const issues = validateAdjustments([adjustment]);
  if (issues.length > 0) throw new ValidationError(issues);
  await db.transaction(async (tx) => {
    const shift = await getShiftDetail(tx, shiftId);
    if (!shift) throw new NotFoundError('shift_not_found');
    await tx.run('INSERT INTO earnings_adjustments (shift_id, kind, label, amount_cents, created_at) VALUES (?, ?, ?, ?, ?)', [
      shiftId,
      adjustment.kind,
      adjustment.label?.trim() || null,
      adjustment.amountCents,
      now,
    ]);
    await refreshResultsIfFinished(tx, shiftId, now);
  });
}

export async function removeAdjustment(db: Db, adjustmentId: number, now: number): Promise<void> {
  await db.transaction(async (tx) => {
    const row = await tx.get<{ shift_id: number }>('SELECT shift_id FROM earnings_adjustments WHERE id = ?', [adjustmentId]);
    if (!row) return;
    await tx.run('DELETE FROM earnings_adjustments WHERE id = ?', [adjustmentId]);
    await refreshResultsIfFinished(tx, row.shift_id, now);
  });
}

async function refreshResultsIfFinished(tx: DbExecutor, shiftId: number, now: number): Promise<void> {
  const shift = await getShiftDetail(tx, shiftId);
  if (!shift || shift.endAt === null) return;
  const endAt = shift.endAt;
  const results = await computeResults(tx, {
    payRuleId: shift.payRuleId,
    startAt: shift.startAt,
    endAt,
    breaks: shift.breaks.map((b) => ({ startAt: b.startAt, endAt: b.endAt ?? endAt, isPaid: b.isPaid })),
    adjustments: shift.adjustments,
  });
  await updateShiftRow(tx, shiftId, {
    employerId: shift.employerId,
    payRuleId: shift.payRuleId,
    startAt: shift.startAt,
    endAt,
    localDate: shift.localDate,
    notes: shift.notes,
    results,
    now,
  });
}
