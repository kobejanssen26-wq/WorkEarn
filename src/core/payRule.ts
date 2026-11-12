/** Pay rule defaults and validation (pure). */

import { ALL_WEEKDAYS_MASK, INTERVAL_OPTIONS, ROUNDING_MODES } from './types';
import type { CustomBonus, FixedBonus, PayRule, Premium, ShiftBreak } from './types';

export const SUPPORTED_CURRENCIES = ['EUR', 'GBP', 'CHF', 'USD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN'] as const;
export const DEFAULT_CURRENCY = 'EUR';

/** Upper bounds keep every intermediate value far inside safe-integer range. */
export const MAX_RATE_UNITS = 10_000_000; // 1 000 per hour
export const MAX_PERCENT_BP = 100_000; // 1 000 %
export const MAX_FIXED_BONUS_CENTS = 100_000_000; // 1 000 000
export const MAX_ADJUSTMENT_CENTS = 100_000_000;
export const MAX_SHIFT_MS = 31 * 24 * 3_600_000;

export interface Issue {
  /** Machine readable location, e.g. "hourlyRate" or "customBonuses.0.name". */
  field: string;
  /** Stable code translated by the UI (`error.<code>`). */
  code: string;
}

export function defaultPayRule(currency: string = DEFAULT_CURRENCY, hourlyRate = 0): PayRule {
  return {
    currency,
    hourlyRate,
    weekdayRates: {},
    saturday: null,
    sunday: null,
    holiday: null,
    customBonuses: [],
    fixedBonuses: [],
    intervalMinutes: 0,
    roundingMode: 'nearest',
  };
}

export function clonePayRule(rule: PayRule): PayRule {
  return {
    ...rule,
    weekdayRates: { ...rule.weekdayRates },
    saturday: rule.saturday ? { ...rule.saturday } : null,
    sunday: rule.sunday ? { ...rule.sunday } : null,
    holiday: rule.holiday ? { ...rule.holiday } : null,
    customBonuses: rule.customBonuses.map((b) => ({ ...b })),
    fixedBonuses: rule.fixedBonuses.map((b) => ({ ...b })),
  };
}

function isInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n);
}

function validatePremium(p: Premium, field: string, issues: Issue[]): void {
  if (!isInt(p.value) || p.value < 0) {
    issues.push({ field: `${field}.value`, code: 'amount_invalid' });
    return;
  }
  if (p.valueType === 'percent' && p.value > MAX_PERCENT_BP) issues.push({ field: `${field}.value`, code: 'percent_too_high' });
  if (p.valueType === 'amount' && p.value > MAX_RATE_UNITS) issues.push({ field: `${field}.value`, code: 'rate_too_high' });
  if (p.valueType !== 'percent' && p.valueType !== 'amount') issues.push({ field: `${field}.valueType`, code: 'amount_invalid' });
  if (p.mode !== 'add' && p.mode !== 'replace') issues.push({ field: `${field}.mode`, code: 'amount_invalid' });
}

export function validateCustomBonus(b: CustomBonus, field: string, issues: Issue[]): void {
  if (b.name.trim().length === 0) issues.push({ field: `${field}.name`, code: 'name_required' });
  validatePremium(b, field, issues);
  if (!isInt(b.weekdayMask) || b.weekdayMask <= 0 || b.weekdayMask > ALL_WEEKDAYS_MASK) {
    issues.push({ field: `${field}.weekdayMask`, code: 'weekdays_required' });
  }
  for (const key of ['startMinute', 'endMinute'] as const) {
    const v = b[key];
    if (!isInt(v) || v < 0 || v > 1439) issues.push({ field: `${field}.${key}`, code: 'window_invalid' });
  }
}

export function validateFixedBonus(b: FixedBonus, field: string, issues: Issue[]): void {
  if (b.name.trim().length === 0) issues.push({ field: `${field}.name`, code: 'name_required' });
  if (!isInt(b.amountCents) || b.amountCents < 0) issues.push({ field: `${field}.amountCents`, code: 'amount_invalid' });
  else if (b.amountCents > MAX_FIXED_BONUS_CENTS) issues.push({ field: `${field}.amountCents`, code: 'amount_too_high' });
}

export function validatePayRule(rule: PayRule): Issue[] {
  const issues: Issue[] = [];
  if (!/^[A-Z]{3}$/.test(rule.currency)) issues.push({ field: 'currency', code: 'currency_invalid' });
  if (!isInt(rule.hourlyRate) || rule.hourlyRate < 0) issues.push({ field: 'hourlyRate', code: 'rate_invalid' });
  else if (rule.hourlyRate > MAX_RATE_UNITS) issues.push({ field: 'hourlyRate', code: 'rate_too_high' });
  for (const [day, rate] of Object.entries(rule.weekdayRates)) {
    if (rate === undefined) continue;
    if (!isInt(rate) || rate < 0) issues.push({ field: `weekdayRates.${day}`, code: 'rate_invalid' });
    else if (rate > MAX_RATE_UNITS) issues.push({ field: `weekdayRates.${day}`, code: 'rate_too_high' });
  }
  if (rule.saturday) validatePremium(rule.saturday, 'saturday', issues);
  if (rule.sunday) validatePremium(rule.sunday, 'sunday', issues);
  if (rule.holiday) validatePremium(rule.holiday, 'holiday', issues);
  rule.customBonuses.forEach((b, i) => validateCustomBonus(b, `customBonuses.${i}`, issues));
  rule.fixedBonuses.forEach((b, i) => validateFixedBonus(b, `fixedBonuses.${i}`, issues));
  if (!INTERVAL_OPTIONS.includes(rule.intervalMinutes)) issues.push({ field: 'intervalMinutes', code: 'interval_invalid' });
  if (!ROUNDING_MODES.includes(rule.roundingMode)) issues.push({ field: 'roundingMode', code: 'rounding_invalid' });
  return issues;
}

/** Validate the times of a (completed or manually entered) shift and its breaks. */
export function validateShiftTimes(args: { startAt: number; endAt: number; breaks: readonly ShiftBreak[] }): Issue[] {
  const issues: Issue[] = [];
  const { startAt, endAt, breaks } = args;
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) {
    issues.push({ field: 'endAt', code: 'time_invalid' });
    return issues;
  }
  if (endAt <= startAt) issues.push({ field: 'endAt', code: 'end_before_start' });
  else if (endAt - startAt > MAX_SHIFT_MS) issues.push({ field: 'endAt', code: 'shift_too_long' });
  const sorted = [...breaks].sort((a, b) => a.startAt - b.startAt);
  sorted.forEach((b, i) => {
    if (b.endAt <= b.startAt) issues.push({ field: `breaks.${i}`, code: 'break_invalid' });
    else if (b.startAt < startAt || b.endAt > endAt) issues.push({ field: `breaks.${i}`, code: 'break_outside' });
    const prev = sorted[i - 1];
    if (prev && b.startAt < prev.endAt) issues.push({ field: `breaks.${i}`, code: 'break_overlap' });
  });
  return issues;
}
