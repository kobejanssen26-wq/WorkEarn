/**
 * Pay calculation engine. Pure functions only: no I/O, no React, no globals.
 *
 * How a shift is priced
 * ---------------------
 * 1. Unpaid breaks are removed from the shift. Paid breaks stay (they are paid time).
 * 2. The remaining paid time is split into slices at every local midnight and at the
 *    start/end of every custom bonus window, so the hourly rate is constant inside a slice.
 *    This is what makes shifts across midnight / weekend / holiday boundaries exact.
 * 3. Each slice is priced with an exact integer rate (see money.ts). The sum of
 *    `rate * milliseconds` is kept as a BigInt and rounded to a whole cent exactly once.
 * 4. FINAL results additionally round the total paid time to the employer's calculation
 *    interval (continuous / 1 / 5 / 10 / 15 / 30 / 60 minutes, down / up / nearest). The
 *    difference is applied at the end of the shift (extra time is paid at the rate in effect
 *    at the end of the shift, removed time is taken off the end). LIVE ESTIMATES never round.
 * 5. Fixed bonuses are added once if their day-type condition is met; tips and extras are added last.
 *
 * Money is never accumulated tick by tick: the live number is recomputed from timestamps.
 */

import { BP_SCALE, centsFromRateNumerator, roundToUnit } from './money';
import {
  MS_PER_MINUTE,
  localDateToMs,
  minuteOfLocalDay,
  startOfLocalDay,
  startOfNextLocalDay,
  toLocalDateString,
  weekdayIndex,
} from './time';
import type {
  Adjustment,
  CustomBonus,
  DayKind,
  PayRule,
  PricedSegment,
  Premium,
  RateSnapshot,
  ShiftBreak,
  ShiftCalculation,
  TimeInterval,
  WeekdayIndex,
} from './types';

export interface CalcInput {
  startAt: number;
  /** End of the shift, or "now" for a live estimate. */
  endAt: number;
  breaks: readonly ShiftBreak[];
  rule: PayRule;
  /** Enabled public holidays as 'YYYY-MM-DD' (local dates). */
  holidays: ReadonlySet<string>;
  adjustments?: readonly Adjustment[];
}

/* ------------------------------------------------------------------ */
/* Rates                                                               */
/* ------------------------------------------------------------------ */

export function dayKindAt(ms: number, holidays: ReadonlySet<string>): DayKind {
  if (holidays.has(toLocalDateString(ms))) return 'holiday';
  const wd = weekdayIndex(ms);
  if (wd === 5) return 'saturday';
  if (wd === 6) return 'sunday';
  return 'weekday';
}

/** Whether a custom bonus window is active on weekday `wd` at `minute` (minutes after local midnight). */
export function isCustomBonusActive(b: CustomBonus, wd: WeekdayIndex, minute: number): boolean {
  const bit = (d: number) => ((b.weekdayMask >> d) & 1) === 1;
  const previous = (wd + 6) % 7;
  if (b.startMinute === b.endMinute) return bit(wd); // whole day
  if (b.startMinute < b.endMinute) return bit(wd) && minute >= b.startMinute && minute < b.endMinute;
  // window crosses midnight: the part after midnight belongs to the day the window started on
  return (bit(wd) && minute >= b.startMinute) || (bit(previous) && minute < b.endMinute);
}

/**
 * The effective hourly rate at an instant.
 *
 * Priority of the day premium: public holiday > Sunday > Saturday (the highest configured
 * one applies, they do not stack). Custom bonuses stack with each other and with the day
 * premium. A "replace" modifier replaces the base rate (the first one by priority wins);
 * "add" modifiers are added on top. Percentages always refer to the day's base rate, so they
 * add up instead of compounding.
 */
export function rateAt(rule: PayRule, ms: number, holidays: ReadonlySet<string>): RateSnapshot {
  const wd = weekdayIndex(ms);
  const minute = minuteOfLocalDay(ms);
  const dayKind = dayKindAt(ms, holidays);
  const weekdayRate = rule.weekdayRates[wd];
  const base = weekdayRate ?? rule.hourlyRate;
  const modifiers: string[] = [];
  if (weekdayRate !== undefined && weekdayRate !== rule.hourlyRate) modifiers.push('weekday_rate');

  const premiums: { premium: Premium; key: string }[] = [];
  const dayPremium = ((): { premium: Premium; key: string } | null => {
    if (dayKind === 'holiday') {
      if (rule.holiday) return { premium: rule.holiday, key: 'holiday' };
      if (wd === 6 && rule.sunday) return { premium: rule.sunday, key: 'sunday' };
      if (wd === 5 && rule.saturday) return { premium: rule.saturday, key: 'saturday' };
      return null;
    }
    if (dayKind === 'sunday' && rule.sunday) return { premium: rule.sunday, key: 'sunday' };
    if (dayKind === 'saturday' && rule.saturday) return { premium: rule.saturday, key: 'saturday' };
    return null;
  })();
  if (dayPremium) premiums.push(dayPremium);
  for (const bonus of rule.customBonuses) {
    if (isCustomBonusActive(bonus, wd, minute)) premiums.push({ premium: bonus, key: `custom:${bonus.name}` });
  }

  let numerator = base * BP_SCALE;
  const replacement = premiums.find((p) => p.premium.mode === 'replace');
  if (replacement) {
    numerator =
      replacement.premium.valueType === 'percent' ? base * replacement.premium.value : replacement.premium.value * BP_SCALE;
  }
  for (const { premium, key } of premiums) {
    modifiers.push(key);
    if (premium.mode === 'add') {
      numerator += premium.valueType === 'percent' ? base * premium.value : premium.value * BP_SCALE;
    }
  }
  return { dayKind, rateNumerator: numerator, rateUnits: numerator / BP_SCALE, baseRateUnits: base, modifiers };
}

/* ------------------------------------------------------------------ */
/* Interval helpers                                                    */
/* ------------------------------------------------------------------ */

export function intervalLength(i: TimeInterval): number {
  return Math.max(0, i.endAt - i.startAt);
}

export function mergeIntervals(list: readonly TimeInterval[]): TimeInterval[] {
  const sorted = list
    .filter((i) => i.endAt > i.startAt)
    .map((i) => ({ startAt: i.startAt, endAt: i.endAt }))
    .sort((a, b) => a.startAt - b.startAt);
  const out: TimeInterval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.startAt <= last.endAt) last.endAt = Math.max(last.endAt, i.endAt);
    else out.push(i);
  }
  return out;
}

/** `base` minus the (already merged, sorted) `cuts`. */
export function subtractIntervals(base: TimeInterval, cuts: readonly TimeInterval[]): TimeInterval[] {
  const out: TimeInterval[] = [];
  let cursor = base.startAt;
  for (const c of cuts) {
    if (c.endAt <= cursor) continue;
    if (c.startAt >= base.endAt) break;
    if (c.startAt > cursor) out.push({ startAt: cursor, endAt: c.startAt });
    cursor = Math.max(cursor, c.endAt);
  }
  if (cursor < base.endAt) out.push({ startAt: cursor, endAt: base.endAt });
  return out;
}

function clip(i: TimeInterval, start: number, end: number): TimeInterval {
  return { startAt: Math.max(i.startAt, start), endAt: Math.min(i.endAt, end) };
}

function atMinute(dayStartMs: number, minute: number): number {
  const d = new Date(dayStartMs);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(minute / 60), minute % 60, 0, 0).getTime();
}

/** Instants strictly inside (a, b) where the hourly rate may change, plus a and b. */
function splitPoints(a: number, b: number, rule: PayRule): number[] {
  const cuts = new Set<number>([a, b]);
  let day = startOfLocalDay(a);
  while (day < b) {
    if (day > a && day < b) cuts.add(day);
    for (const bonus of rule.customBonuses) {
      for (const minute of [bonus.startMinute, bonus.endMinute]) {
        const p = atMinute(day, minute);
        if (p > a && p < b) cuts.add(p);
      }
    }
    day = startOfNextLocalDay(day);
  }
  return [...cuts].sort((x, y) => x - y);
}

function priceInterval(interval: TimeInterval, rule: PayRule, holidays: ReadonlySet<string>): PricedSegment[] {
  const points = splitPoints(interval.startAt, interval.endAt, rule);
  const out: PricedSegment[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const s = points[i] as number;
    const e = points[i + 1] as number;
    if (e <= s) continue;
    const snap = rateAt(rule, s, holidays);
    const seg: PricedSegment = {
      startAt: s,
      endAt: e,
      ms: e - s,
      dayKind: snap.dayKind,
      localDate: toLocalDateString(s),
      rateNumerator: snap.rateNumerator,
      rateUnits: snap.rateUnits,
      modifiers: snap.modifiers,
    };
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.endAt === seg.startAt &&
      prev.rateNumerator === seg.rateNumerator &&
      prev.dayKind === seg.dayKind &&
      prev.localDate === seg.localDate &&
      prev.modifiers.join('|') === seg.modifiers.join('|')
    ) {
      prev.endAt = seg.endAt;
      prev.ms += seg.ms;
    } else {
      out.push(seg);
    }
  }
  return out;
}

/** Apply a rounding difference at the end of the shift (positive = add time, negative = remove time). */
function adjustTail(segments: PricedSegment[], deltaMs: number): PricedSegment[] {
  if (deltaMs === 0 || segments.length === 0) return segments;
  const out = segments.map((s) => ({ ...s }));
  if (deltaMs > 0) {
    const last = out[out.length - 1] as PricedSegment;
    out.push({ ...last, startAt: last.endAt, endAt: last.endAt + deltaMs, ms: deltaMs, synthetic: true });
    return out;
  }
  let remaining = -deltaMs;
  while (remaining > 0 && out.length > 0) {
    const last = out[out.length - 1] as PricedSegment;
    if (last.ms <= remaining) {
      remaining -= last.ms;
      out.pop();
    } else {
      last.ms -= remaining;
      last.endAt -= remaining;
      remaining = 0;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Shift calculation                                                   */
/* ------------------------------------------------------------------ */

/**
 * Calculate a shift. With `estimate: true` the employer's calculation interval is ignored
 * (live display); otherwise the final, interval-rounded result is produced.
 */
export function calculateShift(input: CalcInput, options: { estimate?: boolean } = {}): ShiftCalculation {
  const estimate = options.estimate ?? false;
  const { rule, holidays } = input;
  const startAt = input.startAt;
  const endAt = Math.max(input.endAt, input.startAt);
  const grossMs = endAt - startAt;

  const unpaid = mergeIntervals(
    input.breaks
      .filter((b) => !b.isPaid)
      .map((b) => clip(b, startAt, endAt))
      .filter((i) => i.endAt > i.startAt),
  );
  const unpaidBreakMs = unpaid.reduce((sum, i) => sum + intervalLength(i), 0);
  const paidMs = grossMs - unpaidBreakMs;

  const paidIntervals = subtractIntervals({ startAt, endAt }, unpaid);
  let segments: PricedSegment[] = [];
  for (const interval of paidIntervals) segments.push(...priceInterval(interval, rule, holidays));

  const unit = rule.intervalMinutes * MS_PER_MINUTE;
  const roundedMs = estimate ? paidMs : roundToUnit(paidMs, unit, rule.roundingMode);
  segments = adjustTail(segments, roundedMs - paidMs);

  let numerator = BigInt(0);
  for (const s of segments) numerator += BigInt(s.rateNumerator) * BigInt(s.ms);
  const timeCents = centsFromRateNumerator(numerator);

  const kinds = new Set<DayKind>(segments.filter((s) => s.ms > 0).map((s) => s.dayKind));
  const fixedBonuses: { name: string; cents: number }[] = [];
  if (roundedMs > 0) {
    for (const fb of rule.fixedBonuses) {
      const applies = fb.condition === 'always' || kinds.has(fb.condition);
      if (applies) fixedBonuses.push({ name: fb.name, cents: fb.amountCents });
    }
  }
  const fixedBonusCents = fixedBonuses.reduce((s, f) => s + f.cents, 0);

  let tipsCents = 0;
  let extrasCents = 0;
  for (const a of input.adjustments ?? []) {
    if (a.kind === 'tip') tipsCents += a.amountCents;
    else extrasCents += a.amountCents;
  }
  const adjustmentsCents = tipsCents + extrasCents;

  return {
    isEstimate: estimate,
    grossMs,
    unpaidBreakMs,
    paidMs,
    roundedMs,
    segments,
    timeCents,
    fixedBonuses,
    fixedBonusCents,
    tipsCents,
    extrasCents,
    adjustmentsCents,
    totalCents: timeCents + fixedBonusCents + adjustmentsCents,
  };
}

/** Live estimate for a running shift: open breaks are treated as ending "now". */
export function estimateShift(args: {
  startAt: number;
  now: number;
  breaks: readonly (Omit<ShiftBreak, 'endAt'> & { endAt: number | null })[];
  rule: PayRule;
  holidays: ReadonlySet<string>;
  adjustments?: readonly Adjustment[];
}): ShiftCalculation {
  const breaks: ShiftBreak[] = args.breaks.map((b) => ({
    ...b,
    endAt: b.endAt === null ? args.now : b.endAt,
  }));
  return calculateShift(
    { startAt: args.startAt, endAt: args.now, breaks, rule: args.rule, holidays: args.holidays, adjustments: args.adjustments },
    { estimate: true },
  );
}

/** Earnings preview of the time between two instants for display purposes (no breaks, no rounding). */
export function exactTimeCents(rule: PayRule, startAt: number, endAt: number, holidays: ReadonlySet<string>): number {
  return calculateShift({ startAt, endAt, breaks: [], rule, holidays }, { estimate: true }).timeCents;
}

/** Local midnight of the day containing `ms` (re-exported for convenience in services). */
export { localDateToMs };
