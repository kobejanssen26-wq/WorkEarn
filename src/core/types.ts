/** Pure domain types shared by the calculation engine, database layer and UI. */

export type RoundingMode = 'down' | 'up' | 'nearest';

/** Calculation interval in minutes. 0 = continuous (no rounding of worked time). */
export type IntervalMinutes = 0 | 1 | 5 | 10 | 15 | 30 | 60;
export const INTERVAL_OPTIONS: readonly IntervalMinutes[] = [0, 1, 5, 10, 15, 30, 60];
export const ROUNDING_MODES: readonly RoundingMode[] = ['down', 'up', 'nearest'];

export type BonusMode = 'add' | 'replace';
export type BonusValueType = 'percent' | 'amount';
/** Day category used for premiums. Holiday wins over Sunday, which wins over Saturday. */
export type DayKind = 'weekday' | 'saturday' | 'sunday' | 'holiday';
/** Weekday index: 0 = Monday ... 6 = Sunday. */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const ALL_WEEKDAYS_MASK = 0b1111111;

/**
 * A rate modifier.
 * - valueType "percent": `value` is in basis points of the day's base rate (5000 = 50 %).
 * - valueType "amount":  `value` is in rate units per hour.
 * - mode "add":     the modifier is added on top of the base rate.
 * - mode "replace": the modifier becomes the rate (percent: base * value; amount: value).
 */
export interface Premium {
  valueType: BonusValueType;
  value: number;
  mode: BonusMode;
}

/** A user defined, time-windowed hourly bonus (e.g. night work 22:00-06:00). */
export interface CustomBonus extends Premium {
  id?: number;
  name: string;
  /** Bit 0 = Monday ... bit 6 = Sunday. For windows crossing midnight the bit of the day the window STARTS on is used. */
  weekdayMask: number;
  /** Minutes after local midnight, 0..1439. */
  startMinute: number;
  /** Minutes after local midnight, 0..1439. end <= start crosses midnight; end === start means the whole day. */
  endMinute: number;
}

/** A fixed amount added once to a shift when its condition is met. */
export type FixedBonusCondition = 'always' | 'weekday' | 'saturday' | 'sunday' | 'holiday';
export interface FixedBonus {
  id?: number;
  name: string;
  amountCents: number;
  condition: FixedBonusCondition;
}

/** Complete, immutable-once-used pay configuration of an employer. */
export interface PayRule {
  id?: number;
  employerId?: number;
  version?: number;
  currency: string;
  /** Base hourly wage in rate units (1/10 000 of a currency unit). */
  hourlyRate: number;
  /** Optional per-weekday base rates (0 = Monday). Missing weekday -> hourlyRate. */
  weekdayRates: Partial<Record<WeekdayIndex, number>>;
  saturday: Premium | null;
  sunday: Premium | null;
  holiday: Premium | null;
  customBonuses: CustomBonus[];
  fixedBonuses: FixedBonus[];
  intervalMinutes: IntervalMinutes;
  roundingMode: RoundingMode;
}

export interface TimeInterval {
  startAt: number;
  endAt: number;
}

export interface ShiftBreak extends TimeInterval {
  id?: number;
  isPaid: boolean;
}

export type AdjustmentKind = 'tip' | 'extra';
export interface Adjustment {
  id?: number;
  kind: AdjustmentKind;
  label?: string | null;
  amountCents: number;
}

/** A priced slice of paid working time with constant hourly rate. */
export interface PricedSegment extends TimeInterval {
  ms: number;
  dayKind: DayKind;
  localDate: string;
  /** Effective hourly rate numerator (rate units per hour * 10 000). */
  rateNumerator: number;
  /** Effective hourly rate in rate units per hour (may be fractional when percentages are involved). */
  rateUnits: number;
  /** Human readable reasons the rate differs from the base rate, as stable keys. */
  modifiers: string[];
  /** True for the slice added when worked time is rounded up to the calculation interval. */
  synthetic?: boolean;
}

export interface ShiftCalculation {
  isEstimate: boolean;
  grossMs: number;
  unpaidBreakMs: number;
  paidMs: number;
  /** Paid time after applying the employer's calculation interval (equals paidMs for estimates). */
  roundedMs: number;
  segments: PricedSegment[];
  /** Pay for the worked time, rounded to a whole cent once. */
  timeCents: number;
  fixedBonuses: { name: string; cents: number }[];
  fixedBonusCents: number;
  tipsCents: number;
  extrasCents: number;
  adjustmentsCents: number;
  totalCents: number;
}

export interface RateSnapshot {
  dayKind: DayKind;
  /** Rate numerator, see PricedSegment. */
  rateNumerator: number;
  rateUnits: number;
  baseRateUnits: number;
  modifiers: string[];
}
