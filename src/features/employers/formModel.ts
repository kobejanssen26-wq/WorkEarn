/**
 * Employer form state <-> domain PayRule. Pure and unit-tested: all text parsing goes through
 * the exact decimal parser, never through floating point.
 */

import { bpToPercentString, centsToPlainString, parseDecimal, rateUnitsToPlainString } from '@/core/money';
import { MAX_FIXED_BONUS_CENTS, MAX_PERCENT_BP, MAX_RATE_UNITS, defaultPayRule } from '@/core/payRule';
import { ALL_WEEKDAYS_MASK } from '@/core/types';
import type { BonusMode, BonusValueType, CustomBonus, FixedBonus, FixedBonusCondition, IntervalMinutes, PayRule, Premium, RoundingMode, WeekdayIndex } from '@/core/types';
import type { EmployerWithRule } from '@/db/employers';
import { EMPLOYER_COLORS } from '@/theme/tokens';

export interface PremiumForm {
  enabled: boolean;
  valueType: BonusValueType;
  value: string;
  mode: BonusMode;
}

export interface CustomBonusForm {
  key: string;
  name: string;
  valueType: BonusValueType;
  value: string;
  mode: BonusMode;
  weekdayMask: number;
  startMinute: number;
  endMinute: number;
}

export interface FixedBonusForm {
  key: string;
  name: string;
  amount: string;
  condition: FixedBonusCondition;
}

export interface EmployerForm {
  name: string;
  color: string;
  notes: string;
  currency: string;
  hourlyWage: string;
  weekdayRatesEnabled: boolean;
  weekdayRates: string[];
  saturday: PremiumForm;
  sunday: PremiumForm;
  holiday: PremiumForm;
  customBonuses: CustomBonusForm[];
  fixedBonuses: FixedBonusForm[];
  intervalMinutes: IntervalMinutes;
  roundingMode: RoundingMode;
}

let keyCounter = 0;
export const newKey = () => `k${++keyCounter}`;

const emptyPremium = (): PremiumForm => ({ enabled: false, valueType: 'percent', value: '', mode: 'add' });

export function emptyCustomBonus(): CustomBonusForm {
  return { key: newKey(), name: '', valueType: 'percent', value: '', mode: 'add', weekdayMask: ALL_WEEKDAYS_MASK, startMinute: 22 * 60, endMinute: 6 * 60 };
}

export function emptyFixedBonus(): FixedBonusForm {
  return { key: newKey(), name: '', amount: '', condition: 'always' };
}

const valueToText = (p: Premium, sep: string) => (p.valueType === 'percent' ? bpToPercentString(p.value, sep) : rateUnitsToPlainString(p.value, sep));

function premiumToForm(p: Premium | null, sep: string): PremiumForm {
  if (!p) return emptyPremium();
  return { enabled: true, valueType: p.valueType, value: valueToText(p, sep), mode: p.mode };
}

/** Pre-fill the form from an employer (edit) or defaults (new). `sep` is the locale's decimal separator. */
export function formFromEmployer(employer: EmployerWithRule | null, defaults: { currency: string; colorIndex: number }, sep = '.'): EmployerForm {
  if (!employer) {
    return {
      name: '',
      color: EMPLOYER_COLORS[defaults.colorIndex % EMPLOYER_COLORS.length] as string,
      notes: '',
      currency: defaults.currency,
      hourlyWage: '',
      weekdayRatesEnabled: false,
      weekdayRates: Array.from({ length: 7 }, () => ''),
      saturday: emptyPremium(),
      sunday: emptyPremium(),
      holiday: emptyPremium(),
      customBonuses: [],
      fixedBonuses: [],
      intervalMinutes: 0,
      roundingMode: 'nearest',
    };
  }
  const rule = employer.rule;
  const weekdayRates = Array.from({ length: 7 }, (_, d) => {
    const r = rule.weekdayRates[d as WeekdayIndex];
    return r === undefined ? '' : rateUnitsToPlainString(r, sep);
  });
  return {
    name: employer.name,
    color: employer.color,
    notes: employer.notes ?? '',
    currency: rule.currency,
    hourlyWage: rateUnitsToPlainString(rule.hourlyRate, sep),
    weekdayRatesEnabled: weekdayRates.some((r) => r !== ''),
    weekdayRates,
    saturday: premiumToForm(rule.saturday, sep),
    sunday: premiumToForm(rule.sunday, sep),
    holiday: premiumToForm(rule.holiday, sep),
    customBonuses: rule.customBonuses.map((b) => ({
      key: newKey(),
      name: b.name,
      valueType: b.valueType,
      value: valueToText(b, sep),
      mode: b.mode,
      weekdayMask: b.weekdayMask,
      startMinute: b.startMinute,
      endMinute: b.endMinute,
    })),
    fixedBonuses: rule.fixedBonuses.map((b) => ({ key: newKey(), name: b.name, amount: centsToPlainString(b.amountCents, sep), condition: b.condition })),
    intervalMinutes: rule.intervalMinutes,
    roundingMode: rule.roundingMode,
  };
}

export type FormErrors = Record<string, string>;
export interface FormResult {
  /** Present when the form is valid. */
  rule: PayRule | null;
  /** field -> error code (`error.<code>`), e.g. { hourlyWage: 'rate_invalid' }. */
  errors: FormErrors;
}

function parsePremium(form: PremiumForm, field: string, errors: FormErrors): Premium | null {
  if (!form.enabled) return null;
  return parseValue(form.valueType, form.value, form.mode, field, errors);
}

function parseValue(valueType: BonusValueType, text: string, mode: BonusMode, field: string, errors: FormErrors): Premium | null {
  const parsed = parseDecimal(text, valueType === 'percent' ? 2 : 4);
  if (parsed === null) {
    errors[`${field}.value`] = 'amount_invalid';
    return null;
  }
  if (valueType === 'percent' && parsed > MAX_PERCENT_BP) errors[`${field}.value`] = 'percent_too_high';
  if (valueType === 'amount' && parsed > MAX_RATE_UNITS) errors[`${field}.value`] = 'rate_too_high';
  return { valueType, value: parsed, mode };
}

/** Convert the form to a PayRule; collects an error code for every invalid field. */
export function formToPayRule(form: EmployerForm): FormResult {
  const errors: FormErrors = {};
  if (form.name.trim().length === 0) errors.name = 'name_required';
  else if (form.name.trim().length > 60) errors.name = 'name_too_long';

  const rule = defaultPayRule(form.currency, 0);
  const wage = parseDecimal(form.hourlyWage, 4);
  if (wage === null) errors.hourlyWage = 'rate_invalid';
  else if (wage > MAX_RATE_UNITS) errors.hourlyWage = 'rate_too_high';
  else rule.hourlyRate = wage;

  if (form.weekdayRatesEnabled) {
    form.weekdayRates.forEach((text, day) => {
      if (text.trim() === '') return;
      const v = parseDecimal(text, 4);
      if (v === null) errors[`weekdayRates.${day}`] = 'rate_invalid';
      else if (v > MAX_RATE_UNITS) errors[`weekdayRates.${day}`] = 'rate_too_high';
      else rule.weekdayRates[day as WeekdayIndex] = v;
    });
  }

  rule.saturday = parsePremium(form.saturday, 'saturday', errors);
  rule.sunday = parsePremium(form.sunday, 'sunday', errors);
  rule.holiday = parsePremium(form.holiday, 'holiday', errors);

  form.customBonuses.forEach((b, i) => {
    const field = `customBonuses.${i}`;
    if (b.name.trim().length === 0) errors[`${field}.name`] = 'name_required';
    if (b.weekdayMask <= 0) errors[`${field}.days`] = 'weekdays_required';
    const premium = parseValue(b.valueType, b.value, b.mode, field, errors);
    if (premium) {
      const custom: CustomBonus = { ...premium, name: b.name.trim(), weekdayMask: b.weekdayMask, startMinute: b.startMinute, endMinute: b.endMinute };
      rule.customBonuses.push(custom);
    }
  });

  form.fixedBonuses.forEach((b, i) => {
    const field = `fixedBonuses.${i}`;
    if (b.name.trim().length === 0) errors[`${field}.name`] = 'name_required';
    const cents = parseDecimal(b.amount, 2);
    if (cents === null) errors[`${field}.amount`] = 'amount_invalid';
    else if (cents > MAX_FIXED_BONUS_CENTS) errors[`${field}.amount`] = 'amount_too_high';
    else {
      const fixed: FixedBonus = { name: b.name.trim(), amountCents: cents, condition: b.condition };
      rule.fixedBonuses.push(fixed);
    }
  });

  rule.intervalMinutes = form.intervalMinutes;
  rule.roundingMode = form.roundingMode;
  return { rule: Object.keys(errors).length === 0 ? rule : null, errors };
}

/** Short human summary of the premiums of a pay rule, e.g. ["Sat +50%", "Sun +€2.00/h"]. */
export function premiumSummary(rule: PayRule, fmtRate: (units: number) => string): string[] {
  const part = (label: string, p: Premium | null) => {
    if (!p) return null;
    const amount = p.valueType === 'percent' ? `${bpToPercentString(p.value)}%` : fmtRate(p.value);
    return `${label} ${p.mode === 'add' ? '+' : '='}${amount}`;
  };
  return [part('Sat', rule.saturday), part('Sun', rule.sunday), part('Hol', rule.holiday)].filter((x): x is string => x !== null);
}
