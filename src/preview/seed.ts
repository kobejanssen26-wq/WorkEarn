/**
 * WEB PREVIEW ONLY (see src/db/expoDriver.web.ts): fills an in-memory database with plausible sample data so the real
 * screens can be rendered for store screenshots. It is never bundled into the Android app and never runs on a device.
 */
import { addDaysToDateString, localDateToMs, toLocalDateString } from '@/core/time';
import { createEmployer } from '@/db/employers';
import { ensureBuiltInHolidays } from '@/db/holidays';
import { saveSetting } from '@/db/settings';
import type { Db } from '@/db/types';
import { addAdjustment, pauseShift, resumeShift, saveShift, startShift } from '@/services/shifts';
import { defaultPayRule } from '@/core/payRule';

export async function seedPreviewData(db: Db, language: 'en' | 'nl'): Promise<void> {
  const now = Date.now();
  const today = toLocalDateString(now);
  await saveSetting(db, 'language', language, now);
  await ensureBuiltInHolidays(db, 'BE', 2025, 2027);

  const cafe = defaultPayRule('EUR', 125_000);
  cafe.saturday = { valueType: 'percent', value: 2500, mode: 'add' };
  cafe.sunday = { valueType: 'percent', value: 5000, mode: 'add' };
  cafe.holiday = { valueType: 'percent', value: 10_000, mode: 'add' };
  cafe.intervalMinutes = 15;
  cafe.roundingMode = 'nearest';
  const delivery = defaultPayRule('EUR', 142_000);
  delivery.customBonuses = [{ name: language === 'nl' ? 'Nachtpremie' : 'Night bonus', valueType: 'percent', value: 2000, mode: 'add', weekdayMask: 127, startMinute: 22 * 60, endMinute: 6 * 60 }];
  const bar = defaultPayRule('EUR', 110_000);
  bar.fixedBonuses = [{ name: language === 'nl' ? 'Weekendtoeslag' : 'Weekend bonus', amountCents: 1000, condition: 'sunday' }];

  const cafeId = await createEmployer(db, { name: 'Café Central', color: '#10B981' }, cafe, now);
  const deliveryId = await createEmployer(db, { name: 'Delivery Co', color: '#0EA5E9' }, delivery, now);
  const barId = await createEmployer(db, { name: 'Weekend Bar', color: '#8B5CF6' }, bar, now);

  // Roughly eight weeks of history, deterministic relative to "today".
  const plan: [number, number, string, string, number][] = [
    // [days ago, employer, from, to, tip cents]
    [1, cafeId, '09:00', '17:30', 1200],
    [2, cafeId, '09:00', '14:00', 0],
    [3, deliveryId, '18:00', '23:30', 0],
    [5, barId, '20:00', '02:00', 2150],
    [6, barId, '19:00', '01:00', 1800],
    [8, cafeId, '10:00', '18:00', 900],
    [9, deliveryId, '17:00', '22:00', 0],
    [10, cafeId, '09:00', '15:00', 0],
    [12, deliveryId, '20:00', '02:00', 0],
    [13, barId, '19:00', '00:30', 2600],
    [15, cafeId, '09:00', '17:00', 700],
    [16, cafeId, '09:00', '13:30', 0],
    [18, deliveryId, '18:00', '23:00', 0],
    [20, barId, '20:00', '01:30', 1900],
    [22, cafeId, '10:00', '17:00', 1000],
    [24, deliveryId, '17:30', '22:30', 0],
    [26, cafeId, '09:00', '16:00', 0],
    [29, barId, '19:30', '00:30', 2300],
    [31, cafeId, '09:00', '17:00', 800],
    [34, deliveryId, '18:00', '23:00', 0],
    [37, cafeId, '09:30', '16:30', 0],
    [41, barId, '20:00', '02:00', 2750],
    [44, cafeId, '09:00', '17:30', 1100],
    [48, deliveryId, '17:00', '22:30', 0],
    [52, cafeId, '09:00', '15:30', 0],
  ];
  for (const [daysAgo, employerId, from, to, tip] of plan) {
    const date = addDaysToDateString(today, -daysAgo);
    const [fh, fm] = from.split(':').map(Number) as [number, number];
    const [th, tm] = to.split(':').map(Number) as [number, number];
    const startAt = localDateToMs(date, fh * 60 + fm);
    const crossesMidnight = th * 60 + tm <= fh * 60 + fm;
    const endAt = localDateToMs(crossesMidnight ? addDaysToDateString(date, 1) : date, th * 60 + tm);
    const lunch = endAt - startAt > 6 * 3_600_000 && employerId === cafeId;
    await saveShift(
      db,
      {
        employerId,
        startAt,
        endAt,
        breaks: lunch ? [{ startAt: startAt + 4 * 3_600_000, endAt: startAt + 4 * 3_600_000 + 30 * 60_000, isPaid: false }] : [],
        adjustments: tip > 0 ? [{ kind: 'tip', amountCents: tip }] : [],
        notes: null,
      },
      now,
    );
  }

  // A shift that is running right now: started 2 h 13 min ago with a short unpaid pause.
  const startedAt = now - (2 * 60 + 13) * 60_000;
  const id = await startShift(db, cafeId, startedAt, startedAt);
  await pauseShift(db, id, startedAt + 55 * 60_000, false);
  await resumeShift(db, id, startedAt + 65 * 60_000);
  await addAdjustment(db, id, { kind: 'tip', amountCents: 450 }, now);
}
