/** Statistics from real shift rows (pure functions over finished shifts). */

import { MS_PER_HOUR, divRoundBig } from './money';
import {
  addDaysToDateString,
  addMonthsToDateString,
  endOfMonthDateString,
  formatDateString,
  parseDateString,
  startOfMonthDateString,
  startOfWeekDateString,
} from './time';

export type Granularity = 'day' | 'week' | 'month' | 'year';

export interface StatShift {
  employerId: number;
  /** Local start date 'YYYY-MM-DD'. */
  localDate: string;
  /** Paid time after rounding, ms. */
  roundedMs: number;
  totalCents: number;
}

export interface Bucket {
  /** Stable key, equals startDate. */
  key: string;
  startDate: string;
  endDate: string;
  cents: number;
  ms: number;
  shifts: number;
}

export function bucketStart(date: string, g: Granularity, weekStart: 0 | 6 = 0): string {
  switch (g) {
    case 'day':
      return date;
    case 'week':
      return startOfWeekDateString(date, weekStart);
    case 'month':
      return startOfMonthDateString(date);
    default:
      return formatDateString(parseDateString(date).y, 1, 1);
  }
}

export function bucketEnd(start: string, g: Granularity): string {
  switch (g) {
    case 'day':
      return start;
    case 'week':
      return addDaysToDateString(start, 6);
    case 'month':
      return endOfMonthDateString(start);
    default:
      return formatDateString(parseDateString(start).y, 12, 31);
  }
}

export function previousBucketStart(start: string, g: Granularity): string {
  switch (g) {
    case 'day':
      return addDaysToDateString(start, -1);
    case 'week':
      return addDaysToDateString(start, -7);
    case 'month':
      return addMonthsToDateString(start, -1);
    default:
      return formatDateString(parseDateString(start).y - 1, 1, 1);
  }
}

/** `count` consecutive buckets ending with the bucket that contains `endDate`; empty buckets are included. */
export function buildBuckets(shifts: readonly StatShift[], g: Granularity, endDate: string, count: number, weekStart: 0 | 6 = 0): Bucket[] {
  const starts: string[] = [];
  let cursor = bucketStart(endDate, g, weekStart);
  for (let i = 0; i < count; i++) {
    starts.unshift(cursor);
    cursor = previousBucketStart(cursor, g);
  }
  const map = new Map<string, Bucket>(
    starts.map((s) => [s, { key: s, startDate: s, endDate: bucketEnd(s, g), cents: 0, ms: 0, shifts: 0 }]),
  );
  for (const shift of shifts) {
    const bucket = map.get(bucketStart(shift.localDate, g, weekStart));
    if (!bucket) continue;
    bucket.cents += shift.totalCents;
    bucket.ms += shift.roundedMs;
    bucket.shifts += 1;
  }
  return starts.map((s) => map.get(s) as Bucket);
}

export interface Summary {
  cents: number;
  ms: number;
  shifts: number;
  /** Earnings per worked hour in cents (rounded), null without worked time. */
  avgHourlyCents: number | null;
}

export function summarize(shifts: readonly StatShift[]): Summary {
  let cents = 0;
  let ms = 0;
  for (const s of shifts) {
    cents += s.totalCents;
    ms += s.roundedMs;
  }
  return { cents, ms, shifts: shifts.length, avgHourlyCents: averageHourlyCents(cents, ms) };
}

export function averageHourlyCents(cents: number, ms: number): number | null {
  if (ms <= 0) return null;
  return Number(divRoundBig(BigInt(cents) * BigInt(MS_PER_HOUR), BigInt(ms), 'nearest'));
}

export interface EmployerShare {
  employerId: number;
  cents: number;
  ms: number;
  shifts: number;
  avgHourlyCents: number | null;
  /** Share of total earnings in percent with one decimal as integer tenths (e.g. 375 = 37.5 %). */
  shareTenths: number;
}

export function employerBreakdown(shifts: readonly StatShift[]): EmployerShare[] {
  const map = new Map<number, { cents: number; ms: number; shifts: number }>();
  let total = 0;
  for (const s of shifts) {
    const e = map.get(s.employerId) ?? { cents: 0, ms: 0, shifts: 0 };
    e.cents += s.totalCents;
    e.ms += s.roundedMs;
    e.shifts += 1;
    total += s.totalCents;
    map.set(s.employerId, e);
  }
  return [...map.entries()]
    .map(([employerId, e]) => ({
      employerId,
      ...e,
      avgHourlyCents: averageHourlyCents(e.cents, e.ms),
      shareTenths: total > 0 ? Number(divRoundBig(BigInt(e.cents) * BigInt(1000), BigInt(total), 'nearest')) : 0,
    }))
    .sort((a, b) => b.cents - a.cents);
}

/** Per-day totals for a month calendar, keyed by 'YYYY-MM-DD'. */
export function dailyTotals(shifts: readonly StatShift[]): Map<string, { cents: number; ms: number; shifts: number }> {
  const map = new Map<string, { cents: number; ms: number; shifts: number }>();
  for (const s of shifts) {
    const d = map.get(s.localDate) ?? { cents: 0, ms: 0, shifts: 0 };
    d.cents += s.totalCents;
    d.ms += s.roundedMs;
    d.shifts += 1;
    map.set(s.localDate, d);
  }
  return map;
}
