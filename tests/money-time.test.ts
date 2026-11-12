import { divRoundBig, formatMoney, formatRate, parseDecimal, rateUnitsToPlainString, roundToUnit, scaledToDecimalString } from '@/core/money';
import {
  addDaysToDateString,
  addMonthsToDateString,
  daysInMonth,
  formatClock,
  formatDurationShort,
  formatHoursDecimal,
  isValidDateString,
  isoWeek,
  startOfWeekDateString,
  weekdayOfDateString,
} from '@/core/time';
import { builtInHolidays, easterSunday } from '@/core/holidays';
import { createFormatter } from '@/i18n/format';
import { niceMax } from '@/ui/charts';

describe('exact money helpers', () => {
  it('parses decimals without floating point', () => {
    expect(parseDecimal('12', 4)).toBe(120_000);
    expect(parseDecimal('12.5', 4)).toBe(125_000);
    expect(parseDecimal('12,50', 4)).toBe(125_000);
    expect(parseDecimal('0.1', 2)).toBe(10);
    expect(parseDecimal('1.005', 2)).toBeNull(); // would need rounding -> rejected, never silently altered
    expect(parseDecimal('1.500', 2)).toBe(150); // trailing zeros are fine
    expect(parseDecimal('abc', 2)).toBeNull();
    expect(parseDecimal('', 2)).toBeNull();
    expect(parseDecimal('-5', 2)).toBeNull();
    expect(parseDecimal('-5', 2, true)).toBe(-500);
  });

  it('prints scaled integers back as decimals', () => {
    expect(scaledToDecimalString(125_000, 4)).toBe('12.5');
    expect(rateUnitsToPlainString(120_000)).toBe('12.00');
    expect(rateUnitsToPlainString(123_457)).toBe('12.3457');
    expect(scaledToDecimalString(-580, 2, 2)).toBe('-5.80');
    expect(scaledToDecimalString(5, 2, 2)).toBe('0.05');
  });

  it('divides BigInts with the requested rounding', () => {
    const d = BigInt(10);
    expect(divRoundBig(BigInt(24), d, 'down')).toBe(BigInt(2));
    expect(divRoundBig(BigInt(24), d, 'up')).toBe(BigInt(3));
    expect(divRoundBig(BigInt(24), d, 'nearest')).toBe(BigInt(2));
    expect(divRoundBig(BigInt(25), d, 'nearest')).toBe(BigInt(3)); // half rounds up
    expect(divRoundBig(BigInt(30), d, 'up')).toBe(BigInt(3)); // exact stays exact
  });

  it('rounds durations to a unit', () => {
    const m = 60_000;
    expect(roundToUnit(29 * m, 15 * m, 'down')).toBe(15 * m);
    expect(roundToUnit(29 * m, 15 * m, 'up')).toBe(30 * m);
    expect(roundToUnit(29 * m, 15 * m, 'nearest')).toBe(30 * m);
    expect(roundToUnit(7 * m + 30_000, 15 * m, 'nearest')).toBe(15 * m); // exactly half rounds up
    expect(roundToUnit(30 * m, 15 * m, 'up')).toBe(30 * m); // already aligned
    expect(roundToUnit(12_345, 0, 'down')).toBe(12_345); // continuous
    expect(roundToUnit(0, 15 * m, 'up')).toBe(0);
  });

  it('formats money for display', () => {
    expect(formatMoney(580, 'EUR', 'en-GB')).toBe('€5.80');
    expect(formatMoney(-580, 'EUR', 'en-GB')).toBe('-€5.80');
    expect(formatRate(120_000, 'EUR', 'en-GB')).toBe('€12.00');
    expect(formatRate(123_457, 'EUR', 'en-GB')).toBe('€12.3457');
    expect(formatMoney(580, 'EUR', 'nl-BE').replace(/\s/g, ' ')).toMatch(/5,80/);
  });
});

describe('time helpers', () => {
  it('knows weekdays (Monday = 0)', () => {
    expect(weekdayOfDateString('2026-03-09')).toBe(0);
    expect(weekdayOfDateString('2026-03-14')).toBe(5);
    expect(weekdayOfDateString('2026-03-15')).toBe(6);
    expect(weekdayOfDateString('2026-11-12')).toBe(3);
    expect(weekdayOfDateString('1970-01-01')).toBe(3);
  });

  it('does calendar arithmetic', () => {
    expect(addDaysToDateString('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDaysToDateString('2026-01-01', -1)).toBe('2025-12-31');
    expect(addMonthsToDateString('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsToDateString('2026-03-15', -3)).toBe('2025-12-15');
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(startOfWeekDateString('2026-03-11', 0)).toBe('2026-03-09');
    expect(startOfWeekDateString('2026-03-11', 6)).toBe('2026-03-08');
    expect(startOfWeekDateString('2026-03-15', 0)).toBe('2026-03-09');
    expect(isValidDateString('2026-02-29')).toBe(false);
    expect(isValidDateString('2028-02-29')).toBe(true);
  });

  it('computes ISO weeks', () => {
    expect(isoWeek('2026-01-01')).toEqual({ year: 2026, week: 1 });
    expect(isoWeek('2020-12-31')).toEqual({ year: 2020, week: 53 });
    expect(isoWeek('2021-01-03')).toEqual({ year: 2020, week: 53 });
    expect(isoWeek('2026-03-09')).toEqual({ year: 2026, week: 11 });
  });

  it('formats durations', () => {
    expect(formatClock(29 * 60_000 + 5_000)).toBe('0:29:05');
    expect(formatClock(26 * 3_600_000)).toBe('26:00:00');
    expect(formatClock(90_000, false)).toBe('0:01');
    expect(formatDurationShort(7.5 * 3_600_000)).toBe('7h 30m');
    expect(formatDurationShort(45 * 60_000)).toBe('45m');
    expect(formatHoursDecimal(27_000_000)).toBe('7.50');
    expect(formatHoursDecimal(27_000_000, ',')).toBe('7,50');
  });
});

describe('public holidays', () => {
  it('computes Easter Sunday', () => {
    expect(easterSunday(2024)).toBe('2024-03-31');
    expect(easterSunday(2025)).toBe('2025-04-20');
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2027)).toBe('2027-03-28');
    expect(easterSunday(2030)).toBe('2030-04-21');
  });

  it('lists the ten Belgian public holidays', () => {
    const be = builtInHolidays('BE', 2026).map((h) => [h.date, h.key]);
    expect(be).toEqual([
      ['2026-01-01', 'new_year'],
      ['2026-04-06', 'easter_monday'],
      ['2026-05-01', 'labour_day'],
      ['2026-05-14', 'ascension'],
      ['2026-05-25', 'whit_monday'],
      ['2026-07-21', 'national_day_be'],
      ['2026-08-15', 'assumption'],
      ['2026-11-01', 'all_saints'],
      ['2026-11-11', 'armistice'],
      ['2026-12-25', 'christmas'],
    ]);
    const be2025 = builtInHolidays('BE', 2025).map((h) => h.date);
    expect(be2025).toContain('2025-04-21');
    expect(be2025).toContain('2025-05-29');
    expect(be2025).toContain('2025-06-09');
  });

  it('handles national specialities', () => {
    expect(builtInHolidays('NL', 2025).find((h) => h.key === 'kings_day')?.date).toBe('2025-04-26'); // 27 April is a Sunday
    expect(builtInHolidays('NL', 2026).find((h) => h.key === 'kings_day')?.date).toBe('2026-04-27');
    expect(builtInHolidays('DE', 2026).find((h) => h.key === 'good_friday')?.date).toBe('2026-04-03');
    expect(builtInHolidays('FR', 2026).find((h) => h.key === 'victory_1945')?.date).toBe('2026-05-08');
    expect(builtInHolidays('LU', 2026).find((h) => h.key === 'national_day_lu')?.date).toBe('2026-06-23');
    expect(builtInHolidays('NONE', 2026)).toEqual([]);
  });
});

describe('compact money and chart axis helpers', () => {
  const en = createFormatter('en-GB', 'auto');
  const nl = createFormatter('nl-BE', 'auto');
  it('keeps small amounts precise and large ones short', () => {
    expect(en.compactMoney(550, 'EUR')).toBe('€5.5');
    expect(en.compactMoney(600, 'EUR')).toBe('€6');
    expect(en.compactMoney(10_050, 'EUR')).toBe('€101'); // no noisy decimals above 10
    expect(en.compactMoney(212_000, 'EUR')).toBe('€2.1k');
    expect(en.compactMoney(-550, 'EUR')).toBe('-€5.5');
    expect(nl.compactMoney(550, 'EUR')).toBe('€5,5');
  });
  it('rounds chart maxima to readable axis values', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(130)).toBe(200);
    expect(niceMax(240)).toBe(250);
    expect(niceMax(420)).toBe(500);
    expect(niceMax(35_686)).toBe(50_000);
  });
});
