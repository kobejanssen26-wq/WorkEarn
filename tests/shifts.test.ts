import { estimateShift } from '@/core/engine';
import { loadPayRule } from '@/db/payRules';
import { getActiveShift, getShiftDetail, getTotalsForRange, listShifts } from '@/db/shifts';
import { getEnabledHolidayDates } from '@/db/holidays';
import {
  addAdjustment,
  deleteShift,
  discardActiveShift,
  pauseShift,
  removeAdjustment,
  resumeShift,
  saveShift,
  setActiveShiftStart,
  setOpenBreakPaid,
  startShift,
  stopShift,
} from '@/services/shifts';
import { updateEmployer } from '@/db/employers';
import { HOUR, MIN, at, makeEmployer, openTestDb, rule } from './helpers/db';

const D = '2026-03-10'; // Tuesday

describe('live shift lifecycle', () => {
  it('starts, pauses, resumes and stops with an unpaid pause excluded', async () => {
    const db = await openTestDb();
    const emp = await makeEmployer(db);
    const id = await startShift(db, emp, at(D, '09:00'));
    expect((await getActiveShift(db))?.id).toBe(id);

    await pauseShift(db, id, at(D, '11:00'));
    await expect(pauseShift(db, id, at(D, '11:01'))).rejects.toThrow(/already_paused/);
    await resumeShift(db, id, at(D, '11:30'));
    await expect(resumeShift(db, id, at(D, '11:31'))).rejects.toThrow(/not_paused/);

    const done = await stopShift(db, id, at(D, '13:00'));
    expect(done.endAt).toBe(at(D, '13:00'));
    expect(done.paidMs).toBe(3.5 * HOUR);
    expect(done.totalCents).toBe(4200); // 3.5h x 12
    expect(done.breaks).toHaveLength(1);
    expect(done.breaks[0]).toMatchObject({ isPaid: false, kind: 'pause' });
    expect(await getActiveShift(db)).toBeNull();
    await expect(stopShift(db, id, at(D, '14:00'))).rejects.toThrow(/shift_not_active/);
  });

  it('counts a pause that is switched to paid as worked time', async () => {
    const db = await openTestDb();
    const emp = await makeEmployer(db);
    const id = await startShift(db, emp, at(D, '09:00'));
    await pauseShift(db, id, at(D, '10:00'), false);
    await setOpenBreakPaid(db, id, true);
    await resumeShift(db, id, at(D, '10:30'));
    expect((await stopShift(db, id, at(D, '11:00'))).totalCents).toBe(2400);
  });

  it('closes an open pause when the shift is stopped', async () => {
    const db = await openTestDb();
    const emp = await makeEmployer(db);
    const id = await startShift(db, emp, at(D, '09:00'));
    await pauseShift(db, id, at(D, '10:00'));
    const done = await stopShift(db, id, at(D, '10:30'));
    expect(done.breaks[0]?.endAt).toBe(at(D, '10:30'));
    expect(done.paidMs).toBe(1 * HOUR);
    expect(done.totalCents).toBe(1200);
  });

  it('applies the employer rounding only when the shift is stopped', async () => {
    const db = await openTestDb();
    const emp = await makeEmployer(db, 'Rounder', rule({ intervalMinutes: 15, roundingMode: 'down' }));
    const id = await startShift(db, emp, at(D, '09:00'));
    const active = (await getActiveShift(db))!;
    const live = estimateShift({
      startAt: active.startAt,
      now: at(D, '09:29'),
      breaks: active.breaks,
      rule: (await loadPayRule(db, active.payRuleId))!,
      holidays: await getEnabledHolidayDates(db),
    });
    expect(live.totalCents).toBe(580);
    const done = await stopShift(db, id, at(D, '09:29'));
    expect(done.roundedMs).toBe(15 * MIN);
    expect(done.totalCents).toBe(300);
  });

  it('supports discarding, correcting the start and tips on a running shift', async () => {
    const db = await openTestDb();
    const emp = await makeEmployer(db);
    const id = await startShift(db, emp, at(D, '09:00'));
    await expect(setActiveShiftStart(db, id, at(D, '10:00'), at(D, '09:30'))).rejects.toThrow(/start_in_future/);
    await setActiveShiftStart(db, id, at(D, '08:30'), at(D, '09:30'));
    await addAdjustment(db, id, { kind: 'tip', amountCents: 400 }, at(D, '09:40'));
    const done = await stopShift(db, id, at(D, '10:30'));
    expect(done.startAt).toBe(at(D, '08:30'));
    expect(done.totalCents).toBe(2400 + 400);

    const second = await startShift(db, emp, at(D, '12:00'));
    await discardActiveShift(db, second);
    expect(await getActiveShift(db)).toBeNull();
    expect((await listShifts(db)).map((s) => s.id)).toEqual([id]);
  });

  it('handles a shift that crosses midnight and is attributed to its start date', async () => {
    const db = await openTestDb();
    const emp = await makeEmployer(db, 'Night club', rule({ saturday: { valueType: 'percent', value: 5000, mode: 'add' } }));
    const id = await startShift(db, emp, at('2026-03-13', '22:00'));
    const done = await stopShift(db, id, at('2026-03-14', '02:00'));
    expect(done.localDate).toBe('2026-03-13');
    expect(done.totalCents).toBe(6000);
  });
});

describe('manual entry and editing', () => {
  it('creates, edits and deletes a shift, keeping statistics in sync', async () => {
    const db = await openTestDb();
    const emp = await makeEmployer(db);
    const id = await saveShift(
      db,
      {
        employerId: emp,
        startAt: at(D, '09:00'),
        endAt: at(D, '17:00'),
        breaks: [{ startAt: at(D, '12:00'), endAt: at(D, '12:30'), isPaid: false }],
        adjustments: [{ kind: 'tip', amountCents: 1000 }],
        notes: '  Busy day ',
      },
      at(D, '18:00'),
    );
    let shift = (await getShiftDetail(db, id))!;
    expect(shift).toMatchObject({ source: 'manual', notes: 'Busy day', paidMs: 7.5 * HOUR, totalCents: 9000 + 1000, localDate: D });
    expect(await getTotalsForRange(db, D, D)).toEqual({ cents: 10_000, ms: 7.5 * HOUR, shifts: 1 });

    // edit: shorter shift, no break, no tip
    await saveShift(db, { id, employerId: emp, startAt: at(D, '09:00'), endAt: at(D, '13:00'), breaks: [], adjustments: [], notes: null }, at(D, '19:00'));
    shift = (await getShiftDetail(db, id))!;
    expect(shift).toMatchObject({ totalCents: 4800, notes: null });
    expect(shift.breaks).toHaveLength(0);
    expect(shift.adjustments).toHaveLength(0);
    expect(await getTotalsForRange(db, D, D)).toEqual({ cents: 4800, ms: 4 * HOUR, shifts: 1 });

    await deleteShift(db, id);
    expect(await getTotalsForRange(db, D, D)).toEqual({ cents: 0, ms: 0, shifts: 0 });
    await expect(deleteShift(db, id)).rejects.toThrow(/shift_not_found/);
  });

  it('moves a shift to another day and updates the per-day totals', async () => {
    const db = await openTestDb();
    const emp = await makeEmployer(db);
    const id = await saveShift(db, { employerId: emp, startAt: at(D, '09:00'), endAt: at(D, '10:00'), breaks: [], adjustments: [] }, at(D, '11:00'));
    await saveShift(db, { id, employerId: emp, startAt: at('2026-03-11', '09:00'), endAt: at('2026-03-11', '10:00'), breaks: [], adjustments: [] }, at(D, '11:00'));
    expect((await getTotalsForRange(db, D, D)).shifts).toBe(0);
    expect((await getTotalsForRange(db, '2026-03-11', '2026-03-11')).cents).toBe(1200);
  });

  it('keeps the original pay rules when editing, unless the employer changes or re-pricing is requested', async () => {
    const db = await openTestDb();
    const a = await makeEmployer(db, 'A', rule({ hourlyRate: 120_000 }));
    const b = await makeEmployer(db, 'B', rule({ hourlyRate: 200_000 }));
    const input = { employerId: a, startAt: at(D, '09:00'), endAt: at(D, '10:00'), breaks: [], adjustments: [] };
    const id = await saveShift(db, input, at(D, '11:00'));
    expect((await getShiftDetail(db, id))?.totalCents).toBe(1200);

    // A gets a raise (new pay rule version because the old one is used)
    await updateEmployer(db, a, { name: 'A', color: '#10B981' }, rule({ hourlyRate: 150_000 }), at(D, '12:00'));
    await saveShift(db, { ...input, id, notes: 'edited note' }, at(D, '12:30'));
    expect((await getShiftDetail(db, id))?.totalCents).toBe(1200); // still the old rate

    await saveShift(db, { ...input, id, useCurrentRule: true }, at(D, '12:45'));
    expect((await getShiftDetail(db, id))?.totalCents).toBe(1500); // explicitly re-priced

    await saveShift(db, { ...input, id, employerId: b }, at(D, '13:00'));
    const moved = (await getShiftDetail(db, id))!;
    expect(moved.employerId).toBe(b);
    expect(moved.totalCents).toBe(2000); // employer B's rules
  });

  it('adds and removes tips / extras and re-totals finished shifts', async () => {
    const db = await openTestDb();
    const emp = await makeEmployer(db);
    const id = await saveShift(db, { employerId: emp, startAt: at(D, '09:00'), endAt: at(D, '10:00'), breaks: [], adjustments: [] }, at(D, '11:00'));
    await addAdjustment(db, id, { kind: 'tip', amountCents: 350 }, at(D, '11:00'));
    await addAdjustment(db, id, { kind: 'extra', label: 'Mileage', amountCents: 800 }, at(D, '11:01'));
    let shift = (await getShiftDetail(db, id))!;
    expect(shift.adjustmentsCents).toBe(1150);
    expect(shift.totalCents).toBe(1200 + 1150);
    await removeAdjustment(db, shift.adjustments[0]!.id, at(D, '11:02'));
    shift = (await getShiftDetail(db, id))!;
    expect(shift.totalCents).toBe(1200 + 800);
    await expect(addAdjustment(db, id, { kind: 'tip', amountCents: -5 }, at(D, '11:03'))).rejects.toThrow(/amount_invalid/);
  });

  it('rejects invalid input and leaves the data untouched', async () => {
    const db = await openTestDb();
    const emp = await makeEmployer(db);
    const base = { employerId: emp, breaks: [], adjustments: [] };
    await expect(saveShift(db, { ...base, startAt: at(D, '10:00'), endAt: at(D, '09:00') }, 1)).rejects.toThrow(/end_before_start/);
    await expect(saveShift(db, { ...base, employerId: 999, startAt: at(D, '09:00'), endAt: at(D, '10:00') }, 1)).rejects.toThrow(/employer_not_found/);
    await expect(saveShift(db, { ...base, id: 424242, startAt: at(D, '09:00'), endAt: at(D, '10:00') }, 1)).rejects.toThrow(/shift_not_found/);
    const running = await startShift(db, emp, at(D, '09:00'));
    await expect(saveShift(db, { ...base, id: running, startAt: at(D, '09:00'), endAt: at(D, '10:00') }, 1)).rejects.toThrow(/shift_active/);
    expect(await listShifts(db)).toHaveLength(0);
  });
});
