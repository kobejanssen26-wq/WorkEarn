import { buildShiftsCsv, sanitizeCell, toCsv } from '@/core/csv';
import type { CsvColumn, ExportShift } from '@/core/csv';
import { averageHourlyCents, buildBuckets, dailyTotals, employerBreakdown, summarize } from '@/core/stats';
import type { StatShift } from '@/core/stats';
import { HOUR, at } from './helpers/db';

const shift = (employerId: number, localDate: string, hours: number, cents: number): StatShift => ({
  employerId,
  localDate,
  roundedMs: hours * HOUR,
  totalCents: cents,
});

const data: StatShift[] = [
  shift(1, '2026-03-09', 8, 9600),
  shift(1, '2026-03-10', 4, 4800),
  shift(2, '2026-03-10', 2, 4000),
  shift(1, '2026-03-16', 8, 9600),
  shift(2, '2026-02-27', 5, 7500),
  shift(1, '2025-12-24', 6, 7200),
];

describe('statistics', () => {
  it('summarises real shifts', () => {
    const s = summarize(data);
    expect(s).toMatchObject({ cents: 42_700, ms: 33 * HOUR, shifts: 6 });
    expect(s.avgHourlyCents).toBe(1294); // 427.00 / 33h = 12.9393 -> 12.94 (rounded half up: 1293.9 -> 1294)
    expect(summarize([]).avgHourlyCents).toBeNull();
    expect(averageHourlyCents(1000, 0)).toBeNull();
  });

  it('builds daily buckets including empty days', () => {
    const b = buildBuckets(data, 'day', '2026-03-11', 4);
    expect(b.map((x) => x.key)).toEqual(['2026-03-08', '2026-03-09', '2026-03-10', '2026-03-11']);
    expect(b.map((x) => x.cents)).toEqual([0, 9600, 8800, 0]);
    expect(b[2]).toMatchObject({ shifts: 2, ms: 6 * HOUR });
  });

  it('builds weekly buckets with a Monday or Sunday week start', () => {
    const monday = buildBuckets(data, 'week', '2026-03-16', 3, 0);
    expect(monday.map((x) => x.startDate)).toEqual(['2026-03-02', '2026-03-09', '2026-03-16']);
    expect(monday.map((x) => x.cents)).toEqual([0, 9600 + 4800 + 4000, 9600]);
    const sunday = buildBuckets(data, 'week', '2026-03-16', 2, 6);
    expect(sunday.map((x) => x.startDate)).toEqual(['2026-03-08', '2026-03-15']);
  });

  it('builds monthly and yearly buckets', () => {
    const months = buildBuckets(data, 'month', '2026-03-31', 4);
    expect(months.map((x) => x.key)).toEqual(['2025-12-01', '2026-01-01', '2026-02-01', '2026-03-01']);
    expect(months.map((x) => x.cents)).toEqual([7200, 0, 7500, 28_000]);
    const years = buildBuckets(data, 'year', '2026-06-01', 2);
    expect(years.map((x) => [x.key, x.cents])).toEqual([
      ['2025-01-01', 7200],
      ['2026-01-01', 35_500],
    ]);
    expect(years[1]?.endDate).toBe('2026-12-31');
  });

  it('compares employers by earnings share', () => {
    const e = employerBreakdown(data);
    expect(e.map((x) => x.employerId)).toEqual([1, 2]);
    expect(e[0]).toMatchObject({ cents: 31_200, shifts: 4 });
    expect(e[1]).toMatchObject({ cents: 11_500, shifts: 2, ms: 7 * HOUR });
    expect(e[0]!.shareTenths + e[1]!.shareTenths).toBe(1000);
    expect(e[1]!.avgHourlyCents).toBe(1643); // 115.00 / 7h = 16.428.. -> 16.43
  });

  it('aggregates per day for the calendar', () => {
    const t = dailyTotals(data);
    expect(t.get('2026-03-10')).toEqual({ cents: 8800, ms: 6 * HOUR, shifts: 2 });
    expect(t.has('2026-03-11')).toBe(false);
  });
});

describe('CSV export', () => {
  const headers = Object.fromEntries(
    ['date', 'employer', 'start', 'end', 'unpaidBreakMinutes', 'paidHours', 'countedHours', 'timeEarnings', 'fixedBonuses', 'tips', 'extras', 'total', 'currency', 'notes'].map((c) => [c, c.toUpperCase()]),
  ) as Record<CsvColumn, string>;
  const row: ExportShift = {
    startAt: at('2026-03-13', '22:00'),
    endAt: at('2026-03-14', '02:00'),
    employerName: 'Café "Zuid"; Bar',
    currency: 'EUR',
    unpaidBreakMs: 30 * 60_000,
    paidMs: 3.5 * HOUR,
    roundedMs: 3.5 * HOUR,
    timeCents: 4200,
    fixedBonusCents: 500,
    tipsCents: 1000,
    extrasCents: -100,
    totalCents: 5600,
    notes: 'line1\nline2',
  };

  it('quotes fields and writes European semicolon CSV with decimal commas', () => {
    const csv = buildShiftsCsv([row], headers, 'semicolon');
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('DATE;EMPLOYER;START;END;UNPAIDBREAKMINUTES;PAIDHOURS;COUNTEDHOURS;TIMEEARNINGS;FIXEDBONUSES;TIPS;EXTRAS;TOTAL;CURRENCY;NOTES');
    expect(lines[1]).toBe('2026-03-13;"Café ""Zuid""; Bar";2026-03-13 22:00;2026-03-14 02:00;30;3,50;3,50;42,00;5,00;10,00;-1,00;56,00;EUR;"line1\nline2"');
  });

  it('writes international comma CSV with decimal points', () => {
    const lines = buildShiftsCsv([row], headers, 'comma').slice(1).split('\r\n');
    expect(lines[1]).toBe('2026-03-13,"Café ""Zuid""; Bar",2026-03-13 22:00,2026-03-14 02:00,30,3.50,3.50,42.00,5.00,10.00,-1.00,56.00,EUR,"line1\nline2"');
  });

  it('protects against spreadsheet formula injection in text fields', () => {
    expect(sanitizeCell('=HYPERLINK("http://x")')).toBe(`'=HYPERLINK("http://x")`);
    expect(sanitizeCell('+1')).toBe("'+1");
    expect(sanitizeCell('-2')).toBe("'-2");
    expect(sanitizeCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(sanitizeCell('Normal')).toBe('Normal');
    const csv = buildShiftsCsv([{ ...row, employerName: '=cmd|calc', notes: '@evil' }], headers, 'comma');
    expect(csv).toContain("'=cmd|calc");
    expect(csv).toContain("'@evil");
    expect(toCsv([['a', 'b']], 'comma')).toBe('﻿a,b\r\n');
  });
});
