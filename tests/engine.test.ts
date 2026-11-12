import { calculateShift, estimateShift, rateAt } from '@/core/engine';
import { validatePayRule, validateShiftTimes } from '@/core/payRule';
import type { CustomBonus, PayRule } from '@/core/types';
import { HOUR, MIN, at, rule } from './helpers/db';

const NO_HOLIDAYS: ReadonlySet<string> = new Set();
const calc = (r: PayRule, startAt: number, endAt: number, extra: Partial<Parameters<typeof calculateShift>[0]> = {}) =>
  calculateShift({ startAt, endAt, breaks: [], rule: r, holidays: NO_HOLIDAYS, ...extra });

// 2026-03-09 is a Monday, 03-14 a Saturday, 03-15 a Sunday, 2026-05-01 a Friday (Labour Day).

describe('hourly wage calculation', () => {
  it('EUR 12/hour for 29 minutes is exactly EUR 5.80', () => {
    const start = at('2026-03-10', '09:00');
    const live = estimateShift({ startAt: start, now: start + 29 * MIN, breaks: [], rule: rule(), holidays: NO_HOLIDAYS });
    expect(live.timeCents).toBe(580);
    expect(live.isEstimate).toBe(true);
  });

  it('prices whole shifts', () => {
    expect(calc(rule(), at('2026-03-10', '09:00'), at('2026-03-10', '17:00')).totalCents).toBe(9600);
    expect(calc(rule(), at('2026-03-10', '09:00'), at('2026-03-10', '09:00')).totalCents).toBe(0);
  });

  it('rounds to a cent only once, at the end', () => {
    // 12.3456/h for one hour = 12.3456 -> 12.35
    expect(calc(rule({ hourlyRate: 123_456 }), at('2026-03-10', '09:00'), at('2026-03-10', '10:00')).totalCents).toBe(1235);
    // 12/h for 10 seconds = 3.33 cents -> 3 ; for 1 second = 0.33 -> 0
    const s = at('2026-03-10', '09:00');
    expect(calc(rule(), s, s + 10_000).totalCents).toBe(3);
    expect(calc(rule(), s, s + 1_000).totalCents).toBe(0);
  });

  it('never accumulates rounding drift: the estimate at every second equals the closed form', () => {
    const s = at('2026-03-10', '09:00');
    let previous = 0;
    for (let sec = 0; sec <= 3600; sec++) {
      const now = s + sec * 1000;
      const cents = estimateShift({ startAt: s, now, breaks: [], rule: rule(), holidays: NO_HOLIDAYS }).timeCents;
      // 12.00/h = 0.3333.. cents per second, rounded half up once
      expect(cents).toBe(Math.floor((sec * 1200) / 3600 + 0.5));
      expect(cents).toBeGreaterThanOrEqual(previous);
      previous = cents;
    }
    expect(previous).toBe(1200);
  });
});

describe('calculation intervals and rounding', () => {
  const s = at('2026-03-10', '09:00');
  const e = s + 29 * MIN;
  const price = (intervalMinutes: PayRule['intervalMinutes'], roundingMode: PayRule['roundingMode'], minutes = 29) =>
    calc(rule({ intervalMinutes, roundingMode }), s, s + minutes * MIN).totalCents;

  it.each([
    // interval, mode, expected cents for 29 minutes at EUR 12/h
    [0, 'down', 580],
    [0, 'up', 580],
    [0, 'nearest', 580],
    [1, 'down', 580],
    [1, 'up', 580],
    [5, 'down', 500],
    [5, 'up', 600],
    [5, 'nearest', 600],
    [10, 'down', 400],
    [10, 'up', 600],
    [10, 'nearest', 600],
    [15, 'down', 300],
    [15, 'up', 600],
    [15, 'nearest', 600],
    [30, 'down', 0],
    [30, 'up', 600],
    [30, 'nearest', 600],
    [60, 'down', 0],
    [60, 'up', 1200],
    [60, 'nearest', 0],
  ] as const)('interval %i min, %s -> %i cents', (interval, mode, expected) => {
    expect(price(interval, mode)).toBe(expected);
  });

  it('rounds half up for "nearest"', () => {
    expect(price(60, 'nearest', 30)).toBe(1200);
    expect(price(60, 'nearest', 31)).toBe(1200);
    expect(price(15, 'nearest', 22)).toBe(300); // 22 -> 15
    expect(price(15, 'nearest', 23)).toBe(600); // 23 -> 30
  });

  it('rounds per minute', () => {
    const r = (m: PayRule['roundingMode']) => rule({ intervalMinutes: 1, roundingMode: m });
    expect(calc(r('down'), s, s + 29 * MIN + 40_000).roundedMs).toBe(29 * MIN);
    expect(calc(r('up'), s, s + 29 * MIN + 1).roundedMs).toBe(30 * MIN);
    expect(calc(r('nearest'), s, s + 29 * MIN + 30_000).roundedMs).toBe(30 * MIN);
  });

  it('keeps the live estimate separate from the final rounded earnings', () => {
    const r = rule({ intervalMinutes: 15, roundingMode: 'down' });
    const live = estimateShift({ startAt: s, now: e, breaks: [], rule: r, holidays: NO_HOLIDAYS });
    const final = calc(r, s, e);
    expect(live.isEstimate).toBe(true);
    expect(live.totalCents).toBe(580); // live is never rounded
    expect(final.isEstimate).toBe(false);
    expect(final.paidMs).toBe(29 * MIN);
    expect(final.roundedMs).toBe(15 * MIN);
    expect(final.totalCents).toBe(300);
  });

  it('prices time added by rounding up at the rate in effect at the end of the shift', () => {
    // Fri 23:50 -> 23:59 plus rounding up to 30 min: rate is the weekday rate (no Saturday premium before midnight)
    const sat = { valueType: 'percent', value: 5000, mode: 'add' } as const;
    const r = rule({ saturday: sat, intervalMinutes: 30, roundingMode: 'up' });
    const result = calc(r, at('2026-03-13', '23:20'), at('2026-03-13', '23:59'));
    expect(result.roundedMs).toBe(60 * MIN);
    expect(result.totalCents).toBe(1200);
    // Rounding down removes time from the end, across segments if necessary
    const down = rule({ saturday: sat, intervalMinutes: 60, roundingMode: 'down' });
    const crossing = calc(down, at('2026-03-13', '23:30'), at('2026-03-14', '00:40')); // 70 min -> 60 min
    expect(crossing.roundedMs).toBe(60 * MIN);
    // 70 min -> 60 min: the 10 removed minutes come off the end (Saturday part): 30 min x 12 + 30 min x 18 = 15.00
    expect(crossing.totalCents).toBe(1500);
  });
});

describe('weekday, weekend and holiday premiums', () => {
  const sat = at('2026-03-14', '10:00');
  const sun = at('2026-03-15', '10:00');

  it('adds a percentage Saturday bonus', () => {
    const r = rule({ saturday: { valueType: 'percent', value: 5000, mode: 'add' } });
    expect(calc(r, sat, sat + 2 * HOUR).totalCents).toBe(3600); // 2h x 18
    expect(calc(r, sun, sun + 2 * HOUR).totalCents).toBe(2400); // Sunday has no premium
  });

  it('adds an hourly amount bonus', () => {
    const r = rule({ saturday: { valueType: 'amount', value: 20_000, mode: 'add' } }); // +2.00/h
    expect(calc(r, sat, sat + 2 * HOUR).totalCents).toBe(2800);
  });

  it('replaces the base wage with a percentage or an amount', () => {
    const pct = rule({ sunday: { valueType: 'percent', value: 20_000, mode: 'replace' } }); // 200 % of base
    expect(calc(pct, sun, sun + 2 * HOUR).totalCents).toBe(4800);
    const amount = rule({ sunday: { valueType: 'amount', value: 200_000, mode: 'replace' } }); // 20.00/h
    expect(calc(amount, sun, sun + 2 * HOUR).totalCents).toBe(4000);
  });

  it('uses weekday specific base rates', () => {
    const r = rule({ weekdayRates: { 1: 150_000 } }); // Tuesday 15.00
    expect(calc(r, at('2026-03-10', '09:00'), at('2026-03-10', '11:00')).totalCents).toBe(3000);
    expect(calc(r, at('2026-03-11', '09:00'), at('2026-03-11', '11:00')).totalCents).toBe(2400);
  });

  it('applies the public holiday bonus and gives it priority over Sunday', () => {
    const labourDay = '2026-05-01'; // Friday
    const r = rule({ holiday: { valueType: 'percent', value: 10_000, mode: 'add' } });
    const holidays = new Set([labourDay]);
    expect(calc(r, at(labourDay, '09:00'), at(labourDay, '17:00'), { holidays }).totalCents).toBe(19_200); // 8h x 24
    expect(calc(r, at('2026-05-02', '09:00'), at('2026-05-02', '17:00'), { holidays }).totalCents).toBe(9600); // next day: no bonus

    // holiday falling on a Sunday: holiday premium wins, Sunday premium is not stacked
    const both = rule({
      holiday: { valueType: 'percent', value: 10_000, mode: 'add' },
      sunday: { valueType: 'percent', value: 5000, mode: 'add' },
    });
    expect(calc(both, sun, sun + 2 * HOUR, { holidays: new Set(['2026-03-15']) }).totalCents).toBe(4800);
    // no holiday premium configured: the Sunday premium still applies on a holiday-Sunday
    const onlySunday = rule({ sunday: { valueType: 'percent', value: 5000, mode: 'add' } });
    expect(calc(onlySunday, sun, sun + 2 * HOUR, { holidays: new Set(['2026-03-15']) }).totalCents).toBe(3600);
  });

  it('supports custom hourly bonus windows across midnight and stacks them without compounding', () => {
    const night: CustomBonus = {
      name: 'Night',
      valueType: 'percent',
      value: 2000,
      mode: 'add',
      weekdayMask: 0b1111111,
      startMinute: 22 * 60,
      endMinute: 6 * 60,
    };
    const r = rule({ customBonuses: [night] });
    // Mon 20:00 -> Tue 02:00: 2h base (24.00) + 4h at 14.40 (57.60)
    expect(calc(r, at('2026-03-09', '20:00'), at('2026-03-10', '02:00')).totalCents).toBe(8160);

    // Saturday +50 % and Night +20 % add up on the base rate: 12 x (1 + .5 + .2) = 20.40, not 21.60
    const stack = rule({ customBonuses: [night], saturday: { valueType: 'percent', value: 5000, mode: 'add' } });
    // Sat 23:00-00:00 = 20.40 ; Sun 00:00-01:00 (no Sunday premium, night continues) = 14.40
    expect(calc(stack, at('2026-03-14', '23:00'), at('2026-03-15', '01:00')).totalCents).toBe(3480);
  });

  it('attributes the after-midnight part of a window to the day the window started', () => {
    const fridayNight: CustomBonus = {
      name: 'Fri night',
      valueType: 'percent',
      value: 2000,
      mode: 'add',
      weekdayMask: 1 << 4, // Friday only
      startMinute: 22 * 60,
      endMinute: 6 * 60,
    };
    const r = rule({ customBonuses: [fridayNight] });
    expect(calc(r, at('2026-03-13', '22:00'), at('2026-03-14', '02:00')).totalCents).toBe(5760); // 4h x 14.40
    expect(calc(r, at('2026-03-14', '22:00'), at('2026-03-15', '02:00')).totalCents).toBe(4800); // Saturday night: no bonus
  });

  it('reports the effective hourly rate at an instant', () => {
    const r = rule({ saturday: { valueType: 'percent', value: 5000, mode: 'add' } });
    const snap = rateAt(r, at('2026-03-14', '12:00'), NO_HOLIDAYS);
    expect(snap.dayKind).toBe('saturday');
    expect(snap.rateUnits).toBe(180_000);
    expect(snap.modifiers).toContain('saturday');
    expect(rateAt(r, at('2026-03-10', '12:00'), NO_HOLIDAYS).rateUnits).toBe(120_000);
  });
});

describe('breaks', () => {
  const s = at('2026-03-10', '09:00');
  const e = at('2026-03-10', '17:00');

  it('removes unpaid breaks and keeps paid breaks', () => {
    const unpaid = [{ startAt: at('2026-03-10', '12:00'), endAt: at('2026-03-10', '12:30'), isPaid: false }];
    const result = calc(rule(), s, e, { breaks: unpaid });
    expect(result.unpaidBreakMs).toBe(30 * MIN);
    expect(result.paidMs).toBe(7.5 * HOUR);
    expect(result.totalCents).toBe(9000);
    const paid = [{ ...unpaid[0]!, isPaid: true }];
    expect(calc(rule(), s, e, { breaks: paid }).totalCents).toBe(9600);
  });

  it('merges overlapping breaks and clips breaks to the shift', () => {
    const overlapping = [
      { startAt: at('2026-03-10', '12:00'), endAt: at('2026-03-10', '12:30'), isPaid: false },
      { startAt: at('2026-03-10', '12:15'), endAt: at('2026-03-10', '12:45'), isPaid: false },
    ];
    expect(calc(rule(), s, e, { breaks: overlapping }).unpaidBreakMs).toBe(45 * MIN);
    const outside = [{ startAt: at('2026-03-10', '08:30'), endAt: at('2026-03-10', '09:30'), isPaid: false }];
    expect(calc(rule(), s, e, { breaks: outside }).unpaidBreakMs).toBe(30 * MIN);
  });

  it('applies the calculation interval to paid time after breaks', () => {
    const r = rule({ intervalMinutes: 15, roundingMode: 'down' });
    const breaks = [{ startAt: at('2026-03-10', '12:00'), endAt: at('2026-03-10', '12:10'), isPaid: false }];
    const result = calc(r, s, e, { breaks });
    expect(result.paidMs).toBe(8 * HOUR - 10 * MIN);
    expect(result.roundedMs).toBe(7.75 * HOUR);
    expect(result.totalCents).toBe(9300);
  });

  it('prices only the paid time around an unpaid break that spans midnight', () => {
    const r = rule({ sunday: { valueType: 'percent', value: 10_000, mode: 'add' } });
    // Sat 22:00 -> Sun 04:00, unpaid break 23:30 -> 00:30
    const breaks = [{ startAt: at('2026-03-14', '23:30'), endAt: at('2026-03-15', '00:30'), isPaid: false }];
    const result = calc(r, at('2026-03-14', '22:00'), at('2026-03-15', '04:00'), { breaks });
    // Saturday 22:00-23:30 = 1.5h x 12 = 18 ; Sunday 00:30-04:00 = 3.5h x 24 = 84
    expect(result.totalCents).toBe(10_200);
  });
});

describe('shifts across midnight, weekends, holidays and DST', () => {
  it('splits a Friday-to-Saturday shift at midnight', () => {
    const r = rule({ saturday: { valueType: 'percent', value: 5000, mode: 'add' } });
    const result = calc(r, at('2026-03-13', '22:00'), at('2026-03-14', '02:00'));
    expect(result.segments).toHaveLength(2);
    expect(result.segments.map((x) => x.dayKind)).toEqual(['weekday', 'saturday']);
    expect(result.totalCents).toBe(6000); // 2h x 12 + 2h x 18
  });

  it('splits Sunday to Monday', () => {
    const r = rule({ sunday: { valueType: 'percent', value: 10_000, mode: 'add' } });
    expect(calc(r, at('2026-03-15', '22:00'), at('2026-03-16', '02:00')).totalCents).toBe(7200);
  });

  it('switches to the holiday rate exactly at midnight', () => {
    const r = rule({ holiday: { valueType: 'percent', value: 10_000, mode: 'add' } });
    const holidays = new Set(['2026-05-01']);
    expect(calc(r, at('2026-04-30', '22:00'), at('2026-05-01', '02:00'), { holidays }).totalCents).toBe(7200);
  });

  it('handles the spring-forward DST night (23-hour day)', () => {
    const r = rule({ sunday: { valueType: 'percent', value: 10_000, mode: 'add' } });
    const result = calc(r, at('2026-03-28', '22:00'), at('2026-03-29', '06:00'));
    expect(result.grossMs).toBe(7 * HOUR); // 02:00 -> 03:00 does not exist
    expect(result.totalCents).toBe(2400 + 5 * 2400);
  });

  it('handles the fall-back DST night (25-hour day)', () => {
    const r = rule({ sunday: { valueType: 'percent', value: 10_000, mode: 'add' } });
    const result = calc(r, at('2026-10-24', '22:00'), at('2026-10-25', '06:00'));
    expect(result.grossMs).toBe(9 * HOUR); // 02:00-03:00 happens twice
    expect(result.totalCents).toBe(2400 + 7 * 2400);
  });
});

describe('fixed bonuses, tips and extra earnings', () => {
  const fixed = rule({
    fixedBonuses: [
      { name: 'Shift bonus', amountCents: 500, condition: 'always' },
      { name: 'Sunday bonus', amountCents: 1000, condition: 'sunday' },
      { name: 'Holiday bonus', amountCents: 750, condition: 'holiday' },
      { name: 'Weekday bonus', amountCents: 200, condition: 'weekday' },
      { name: 'Saturday bonus', amountCents: 300, condition: 'saturday' },
    ],
  });

  it('adds fixed bonuses once when their day condition is met', () => {
    const weekday = calc(fixed, at('2026-03-10', '09:00'), at('2026-03-10', '10:00'));
    expect(weekday.fixedBonuses.map((b) => b.name)).toEqual(['Shift bonus', 'Weekday bonus']);
    expect(weekday.fixedBonusCents).toBe(700);
    expect(weekday.totalCents).toBe(1200 + 700);

    const sunday = calc(fixed, at('2026-03-15', '09:00'), at('2026-03-15', '10:00'));
    expect(sunday.fixedBonusCents).toBe(1500);

    const holiday = calc(fixed, at('2026-05-01', '09:00'), at('2026-05-01', '10:00'), { holidays: new Set(['2026-05-01']) });
    expect(holiday.fixedBonusCents).toBe(500 + 750);
  });

  it('applies a Saturday fixed bonus when any paid time falls on a Saturday', () => {
    const result = calc(fixed, at('2026-03-13', '23:00'), at('2026-03-14', '01:00'));
    expect(result.fixedBonuses.map((b) => b.name)).toEqual(['Shift bonus', 'Weekday bonus', 'Saturday bonus']);
  });

  it('gives no fixed bonus when rounding removes all paid time', () => {
    const r = { ...fixed, intervalMinutes: 60 as const, roundingMode: 'down' as const };
    const result = calc(r, at('2026-03-10', '09:00'), at('2026-03-10', '09:20'));
    expect(result.roundedMs).toBe(0);
    expect(result.totalCents).toBe(0);
  });

  it('adds tips and extra earnings', () => {
    const result = calc(rule(), at('2026-03-10', '09:00'), at('2026-03-10', '10:00'), {
      adjustments: [
        { kind: 'tip', amountCents: 500 },
        { kind: 'extra', label: 'Travel', amountCents: 250 },
        { kind: 'extra', label: 'Uniform', amountCents: -100 },
      ],
    });
    expect(result.tipsCents).toBe(500);
    expect(result.extrasCents).toBe(150);
    expect(result.adjustmentsCents).toBe(650);
    expect(result.totalCents).toBe(1200 + 650);
  });
});

describe('validation', () => {
  it('accepts a sane pay rule and rejects broken ones', () => {
    expect(validatePayRule(rule())).toEqual([]);
    expect(validatePayRule(rule({ hourlyRate: -1 })).map((i) => i.code)).toContain('rate_invalid');
    expect(validatePayRule(rule({ hourlyRate: 99_999_999 })).map((i) => i.code)).toContain('rate_too_high');
    expect(validatePayRule(rule({ currency: 'euro' })).map((i) => i.code)).toContain('currency_invalid');
    expect(
      validatePayRule(rule({ customBonuses: [{ name: '', valueType: 'percent', value: 10, mode: 'add', weekdayMask: 0, startMinute: 0, endMinute: 5000 }] })).map(
        (i) => i.code,
      ),
    ).toEqual(expect.arrayContaining(['name_required', 'weekdays_required', 'window_invalid']));
  });

  it('validates shift times and breaks', () => {
    const s = at('2026-03-10', '09:00');
    const e = at('2026-03-10', '17:00');
    expect(validateShiftTimes({ startAt: s, endAt: e, breaks: [] })).toEqual([]);
    expect(validateShiftTimes({ startAt: e, endAt: s, breaks: [] })[0]?.code).toBe('end_before_start');
    expect(validateShiftTimes({ startAt: s, endAt: s + 40 * 24 * HOUR, breaks: [] })[0]?.code).toBe('shift_too_long');
    const codes = validateShiftTimes({
      startAt: s,
      endAt: e,
      breaks: [
        { startAt: s - HOUR, endAt: s + HOUR, isPaid: false },
        { startAt: s + 2 * HOUR, endAt: s + 3 * HOUR, isPaid: false },
        { startAt: s + 2.5 * HOUR, endAt: s + 4 * HOUR, isPaid: true },
      ],
    }).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['break_outside', 'break_overlap']));
  });
});
