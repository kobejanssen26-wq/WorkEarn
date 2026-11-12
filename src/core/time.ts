/**
 * Date and time helpers.
 *
 * Two families of helpers live here:
 *  - timestamp helpers (epoch milliseconds, device time zone) used by the shift
 *    engine so that midnight, DST and weekdays are handled with the platform's
 *    time zone rules;
 *  - "civil date" helpers working on 'YYYY-MM-DD' strings with pure integer
 *    arithmetic (no time zone involved) used by calendar and statistics.
 */

import type { WeekdayIndex } from './types';

export const MS_PER_SECOND = 1_000;
export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/* ------------------------------------------------------------------ */
/* Timestamp helpers (device time zone)                                */
/* ------------------------------------------------------------------ */

/** Local calendar date of a timestamp as 'YYYY-MM-DD'. */
export function toLocalDateString(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Local time of a timestamp as 'HH:MM' (24 h). */
export function toLocalTimeString(ms: number): string {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Timestamp of a local date at `minuteOfDay` minutes after midnight. */
export function localDateToMs(dateStr: string, minuteOfDay = 0): number {
  const { y, m, d } = parseDateString(dateStr);
  return new Date(y, m - 1, d, Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0).getTime();
}

export function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function startOfNextLocalDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}

/** 0 = Monday ... 6 = Sunday. */
export function weekdayIndex(ms: number): WeekdayIndex {
  return ((new Date(ms).getDay() + 6) % 7) as WeekdayIndex;
}

export function minuteOfLocalDay(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

/** Combine a local date string and a 'minutes after midnight' value into a timestamp. */
export function combineLocal(dateStr: string, minuteOfDay: number): number {
  return localDateToMs(dateStr, minuteOfDay);
}

/* ------------------------------------------------------------------ */
/* Civil date helpers ('YYYY-MM-DD', no time zone)                     */
/* ------------------------------------------------------------------ */

export interface CivilDate {
  y: number;
  m: number; // 1..12
  d: number; // 1..31
}

export function parseDateString(s: string): CivilDate {
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  return { y, m, d };
}

export function formatDateString(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${pad2(m)}-${pad2(d)}`;
}

export function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { y, m, d } = parseDateString(s);
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= daysInMonth(y, m);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Days since 1970-01-01 for a civil date. */
export function dateStringToDayNumber(s: string): number {
  const { y, m, d } = parseDateString(s);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function dayNumberToDateString(n: number): string {
  const dt = new Date(n * 86_400_000);
  return formatDateString(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDaysToDateString(s: string, days: number): string {
  return dayNumberToDateString(dateStringToDayNumber(s) + days);
}

export function diffDays(a: string, b: string): number {
  return dateStringToDayNumber(a) - dateStringToDayNumber(b);
}

/** 0 = Monday ... 6 = Sunday. 1970-01-01 was a Thursday (index 3). */
export function weekdayOfDateString(s: string): WeekdayIndex {
  const n = dateStringToDayNumber(s);
  return ((((n + 3) % 7) + 7) % 7) as WeekdayIndex;
}

/** First day of the week containing `s`. weekStart: 0 = Monday, 6 = Sunday. */
export function startOfWeekDateString(s: string, weekStart: 0 | 6 = 0): string {
  const wd = weekdayOfDateString(s);
  const back = weekStart === 0 ? wd : (wd + 1) % 7;
  return addDaysToDateString(s, -back);
}

export function startOfMonthDateString(s: string): string {
  const { y, m } = parseDateString(s);
  return formatDateString(y, m, 1);
}

export function endOfMonthDateString(s: string): string {
  const { y, m } = parseDateString(s);
  return formatDateString(y, m, daysInMonth(y, m));
}

export function addMonthsToDateString(s: string, months: number): string {
  const { y, m, d } = parseDateString(s);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return formatDateString(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

export function monthKey(s: string): string {
  return s.slice(0, 7);
}

/** ISO 8601 week number and week-year of a civil date. */
export function isoWeek(s: string): { year: number; week: number } {
  const n = dateStringToDayNumber(s);
  const wd = weekdayOfDateString(s); // Monday = 0
  const thursday = n - wd + 3;
  const thursdayDate = dayNumberToDateString(thursday);
  const year = parseDateString(thursdayDate).y;
  const jan1 = dateStringToDayNumber(formatDateString(year, 1, 1));
  return { year, week: Math.floor((thursday - jan1) / 7) + 1 };
}

/* ------------------------------------------------------------------ */
/* Duration formatting                                                 */
/* ------------------------------------------------------------------ */

/** H:MM:SS (or H:MM) clock style, hours are not capped at 24. */
export function formatClock(ms: number, withSeconds = true): string {
  const total = Math.max(0, Math.floor(ms / MS_PER_SECOND));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return withSeconds ? `${h}:${pad2(m)}:${pad2(s)}` : `${h}:${pad2(m)}`;
}

/** "7h 30m" style duration. Seconds are dropped (floored). */
export function formatDurationShort(ms: number, units: { h: string; m: string } = { h: 'h', m: 'm' }): string {
  const totalMin = Math.max(0, Math.floor(ms / MS_PER_MINUTE));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}${units.m}`;
  if (m === 0) return `${h}${units.h}`;
  return `${h}${units.h} ${m}${units.m}`;
}

/** Hours with two decimals for exports, using plain math on integers (e.g. 27_000_000 ms -> "7.50"). */
export function formatHoursDecimal(ms: number, decimalSeparator = '.'): string {
  const hundredths = Math.round((Math.max(0, ms) * 100) / MS_PER_HOUR);
  const whole = Math.floor(hundredths / 100);
  const frac = hundredths % 100;
  return `${whole}${decimalSeparator}${pad2(frac)}`;
}
