import { calculateShift, estimateShift } from '@/core/engine';
import { defaultPayRule } from '@/core/payRule';
import { localDateToMs } from '@/core/time';

describe('smoke', () => {
  it('€12/h for 29 minutes is exactly €5.80', () => {
    const rule = defaultPayRule('EUR', 120_000);
    const start = localDateToMs('2026-03-10', 9 * 60); // Tuesday
    const calc = estimateShift({ startAt: start, now: start + 29 * 60_000, breaks: [], rule, holidays: new Set() });
    expect(calc.timeCents).toBe(580);
    expect(calc.isEstimate).toBe(true);
    const fin = calculateShift({ startAt: start, endAt: start + 29 * 60_000, breaks: [], rule, holidays: new Set() });
    expect(fin.totalCents).toBe(580);
  });
  it('runs in Europe/Brussels', () => {
    expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(-120);
  });
});
