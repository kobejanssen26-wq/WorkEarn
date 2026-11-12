import { payRuleSignature } from '@/core/payRule';
import { emptyCustomBonus, emptyFixedBonus, formFromEmployer, formToPayRule, premiumSummary } from '@/features/employers/formModel';
import type { EmployerForm } from '@/features/employers/formModel';
import { setActiveShiftStartLocal } from '@/features/home/startTime';
import { createEmployer, getEmployer } from '@/db/employers';
import { T0, at, openTestDb, rule } from './helpers/db';

const base = (): EmployerForm => ({ ...formFromEmployer(null, { currency: 'EUR', colorIndex: 0 }), name: 'Café Central', hourlyWage: '12,50' });

describe('employer form -> pay rule', () => {
  it('parses wages and premiums exactly, accepting comma or point', () => {
    const form: EmployerForm = {
      ...base(),
      weekdayRatesEnabled: true,
      weekdayRates: ['', '15', '', '', '', '', ''],
      saturday: { enabled: true, valueType: 'percent', value: '50', mode: 'add' },
      sunday: { enabled: true, valueType: 'amount', value: '2,5', mode: 'replace' },
      holiday: { enabled: true, valueType: 'percent', value: '12.75', mode: 'add' },
      intervalMinutes: 15,
      roundingMode: 'down',
    };
    const { rule: r, errors } = formToPayRule(form);
    expect(errors).toEqual({});
    expect(r).toMatchObject({
      hourlyRate: 125_000,
      weekdayRates: { 1: 150_000 },
      saturday: { valueType: 'percent', value: 5000, mode: 'add' },
      sunday: { valueType: 'amount', value: 25_000, mode: 'replace' },
      holiday: { valueType: 'percent', value: 1275, mode: 'add' },
      intervalMinutes: 15,
      roundingMode: 'down',
    });
  });

  it('ignores weekday rates when the switch is off and empty days', () => {
    const form: EmployerForm = { ...base(), weekdayRatesEnabled: false, weekdayRates: ['99', '', '', '', '', '', ''] };
    expect(formToPayRule(form).rule?.weekdayRates).toEqual({});
  });

  it('reports an error code for every invalid field', () => {
    const form: EmployerForm = {
      ...base(),
      name: '  ',
      hourlyWage: 'abc',
      saturday: { enabled: true, valueType: 'percent', value: '1001', mode: 'add' },
      sunday: { enabled: true, valueType: 'amount', value: '', mode: 'add' },
      customBonuses: [{ ...emptyCustomBonus(), name: '', value: '5', weekdayMask: 0 }],
      fixedBonuses: [{ ...emptyFixedBonus(), name: '', amount: '-3' }],
    };
    const { rule: r, errors } = formToPayRule(form);
    expect(r).toBeNull();
    expect(errors).toMatchObject({
      name: 'name_required',
      hourlyWage: 'rate_invalid',
      'saturday.value': 'percent_too_high',
      'sunday.value': 'amount_invalid',
      'customBonuses.0.name': 'name_required',
      'customBonuses.0.days': 'weekdays_required',
      'fixedBonuses.0.name': 'name_required',
      'fixedBonuses.0.amount': 'amount_invalid',
    });
  });

  it('rejects a wage that is too high or has more than four decimals', () => {
    expect(formToPayRule({ ...base(), hourlyWage: '1000.01' }).errors.hourlyWage).toBe('rate_too_high');
    expect(formToPayRule({ ...base(), hourlyWage: '12.34567' }).errors.hourlyWage).toBe('rate_invalid');
    expect(formToPayRule({ ...base(), hourlyWage: '12.3456' }).rule?.hourlyRate).toBe(123_456);
  });

  it('round-trips a stored employer back to the identical pay rule', async () => {
    const db = await openTestDb();
    const original = rule({
      hourlyRate: 143_210,
      weekdayRates: { 0: 130_000, 6: 160_000 },
      saturday: { valueType: 'percent', value: 2550, mode: 'add' },
      holiday: { valueType: 'amount', value: 55_000, mode: 'replace' },
      customBonuses: [{ name: 'Night', valueType: 'percent', value: 2000, mode: 'add', weekdayMask: 0b0011111, startMinute: 1320, endMinute: 360 }],
      fixedBonuses: [{ name: 'Opening', amountCents: 1250, condition: 'weekday' }],
      intervalMinutes: 30,
      roundingMode: 'up',
    });
    const id = await createEmployer(db, { name: 'RT', color: '#10B981' }, original, T0);
    const employer = (await getEmployer(db, id))!;
    for (const sep of ['.', ',']) {
      const form = formFromEmployer(employer, { currency: 'EUR', colorIndex: 0 }, sep);
      const result = formToPayRule(form);
      expect(result.errors).toEqual({});
      expect(payRuleSignature(result.rule!)).toBe(payRuleSignature(original));
    }
  });

  it('summarises premiums for list cards', () => {
    const r = rule({ saturday: { valueType: 'percent', value: 5000, mode: 'add' }, sunday: { valueType: 'amount', value: 20_000, mode: 'replace' } });
    expect(premiumSummary(r, (u) => `€${u / 10_000}/h`)).toEqual(['Sat +50%', 'Sun =€2/h']);
  });
});

describe('start time correction for a running shift', () => {
  it('keeps the shift date and applies the picked time', () => {
    const now = at('2026-03-10', '12:00');
    expect(setActiveShiftStartLocal(at('2026-03-10', '09:00'), 8, 30, now)).toBe(at('2026-03-10', '08:30'));
  });
  it('treats a time in the future as yesterday', () => {
    const now = at('2026-03-11', '00:10');
    expect(setActiveShiftStartLocal(at('2026-03-11', '00:05'), 23, 0, now)).toBe(at('2026-03-10', '23:00'));
  });
});
