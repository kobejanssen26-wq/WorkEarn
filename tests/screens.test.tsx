import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import CalendarScreen from '@/features/calendar/CalendarScreen';
import EmployerFormScreen from '@/features/employers/EmployerFormScreen';
import EmployersScreen from '@/features/employers/EmployersScreen';
import ExportScreen from '@/features/settings/ExportScreen';
import SettingsScreen from '@/features/settings/SettingsScreen';
import HistoryScreen from '@/features/shifts/HistoryScreen';
import ShiftEditorScreen from '@/features/shifts/ShiftEditorScreen';
import StatisticsScreen from '@/features/statistics/StatisticsScreen';
import { listEmployers } from '@/db/employers';
import { loadSettings } from '@/db/settings';
import { listShifts } from '@/db/shifts';
import { AppProvider } from '@/state/AppProvider';
import { saveShift } from '@/services/shifts';
import { at, makeEmployer, openTestDb, rule } from './helpers/db';
import { mockState } from './helpers/mockState';
import type { Db } from '@/db/types';

// "Today" is Thursday 12 March 2026, noon.
beforeEach(() => {
  jest.spyOn(Date, 'now').mockImplementation(() => at('2026-03-12', '12:00'));
  mockState.params = {};
  mockState.lastCsv = null;
  mockState.router.push.mockClear();
  mockState.router.back.mockClear();
});
afterEach(() => jest.restoreAllMocks());

async function show(element: React.ReactElement, db: Db) {
  mockState.db = db;
  await render(<AppProvider renderError={(e) => <>{String(e)}</>}>{element}</AppProvider>);
}

async function seed() {
  const db = await openTestDb();
  const cafe = await makeEmployer(db, 'Café', rule({ hourlyRate: 120_000 }));
  const bar = await makeEmployer(db, 'Bar', rule({ hourlyRate: 150_000 }));
  const shift = (employerId: number, date: string, from: string, to: string) =>
    saveShift(db, { employerId, startAt: at(date, from), endAt: at(date, to), breaks: [], adjustments: [] }, at('2026-03-12', '12:00'));
  await shift(cafe, '2026-03-10', '09:00', '17:00'); // 96.00
  await shift(bar, '2026-03-10', '18:00', '22:00'); // 60.00
  await shift(cafe, '2026-03-09', '09:00', '13:00'); // 48.00
  return { db, cafe, bar };
}

describe('employer management', () => {
  it('lists employers and creates a new one with pay rules', async () => {
    const { db } = await seed();
    await show(<EmployersScreen />, db);
    expect(await screen.findByText('Café')).toBeTruthy();
    expect(screen.getByText('€15.00 per hour')).toBeTruthy();

    mockState.params = { id: 'new' };
    await show(<EmployerFormScreen />, db);
    await fireEvent.changeText(await screen.findByLabelText('Company name'), 'Pizzeria Roma');
    await fireEvent.changeText(screen.getByLabelText('Hourly wage'), '13,75');
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(async () => expect((await listEmployers(db)).map((e) => e.name)).toContain('Pizzeria Roma'));
    const created = (await listEmployers(db)).find((e) => e.name === 'Pizzeria Roma')!;
    expect(created.rule.hourlyRate).toBe(137_500);
    expect(mockState.router.back).toHaveBeenCalled();
  });

  it('refuses to save an employer without a name or wage and explains why', async () => {
    const db = await openTestDb();
    mockState.params = { id: 'new' };
    await show(<EmployerFormScreen />, db);
    await fireEvent.press(await screen.findByLabelText('Save'));
    expect(await screen.findByText('Please enter a name.')).toBeTruthy();
    expect(screen.getAllByText('Enter a valid amount.').length).toBeGreaterThan(0);
    expect(await listEmployers(db)).toHaveLength(0);
  });
});

describe('shift editor', () => {
  it('adds a manual shift on the chosen day and shows the earnings preview', async () => {
    const db = await openTestDb();
    await makeEmployer(db, 'Café', rule({ hourlyRate: 120_000 }));
    mockState.params = { id: 'new', date: '2026-03-11' };
    await show(<ShiftEditorScreen />, db);
    expect((await screen.findAllByText('€96.00')).length).toBe(2); // pay for time + total: default 09:00-17:00 at EUR 12/h
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(async () => expect(await listShifts(db)).toHaveLength(1));
    const [saved] = await listShifts(db);
    expect(saved).toMatchObject({ localDate: '2026-03-11', totalCents: 9600, startAt: at('2026-03-11', '09:00'), endAt: at('2026-03-11', '17:00') });
  });

  it('edits an existing shift and updates what is stored', async () => {
    const { db } = await seed();
    const [first] = await listShifts(db, { order: 'asc' });
    mockState.params = { id: String(first!.id) };
    await show(<ShiftEditorScreen />, db);
    await screen.findByText('Delete');
    await fireEvent.press(screen.getByLabelText('Add tip'));
    await fireEvent.changeText(await screen.findByLabelText('Amount'), '5');
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(async () => expect((await listShifts(db, { order: 'asc' }))[0]?.totalCents).toBe(first!.totalCents! + 500));
  });
});

describe('history, calendar and statistics use the real database', () => {
  it('history lists all shifts with employer, time and earnings', async () => {
    const { db } = await seed();
    await show(<HistoryScreen />, db);
    expect(await screen.findByLabelText(/Café, 09:00 . 17:00, €96\.00/)).toBeTruthy();
    expect(screen.getByLabelText(/Bar, 18:00 . 22:00, €60\.00/)).toBeTruthy();
    expect(screen.getByLabelText(/Café, 09:00 . 13:00, €48\.00/)).toBeTruthy();
    expect(screen.getByText('3 shifts')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/Bar, 18:00/));
    expect(mockState.router.push).toHaveBeenCalledWith(expect.stringMatching(/^\/shift\/\d+$/));
  });

  it('calendar shows worked days with daily earnings and the shifts of the selected day', async () => {
    const { db } = await seed();
    await show(<CalendarScreen />, db);
    const day = await screen.findByLabelText('Tuesday 10 March, 2, €156.00');
    await fireEvent.press(day);
    expect(await screen.findByLabelText(/Café, 09:00 . 17:00, €96\.00/)).toBeTruthy();
    expect(screen.getByLabelText(/Bar, 18:00 . 22:00, €60\.00/)).toBeTruthy();
    expect(screen.getByText('Tuesday 10 March')).toBeTruthy();
  });

  it('statistics are calculated from the recorded shifts', async () => {
    const { db } = await seed();
    await show(<StatisticsScreen />, db);
    expect(await screen.findByText('This week')).toBeTruthy();
    expect(screen.getAllByText('€204.00').length).toBeGreaterThan(0); // week 9-15 March: 96 + 60 + 48
    expect(screen.getByText('16h')).toBeTruthy();
    expect(screen.getByText('€12.75/h')).toBeTruthy(); // 204.00 / 16 h
    expect(screen.getByText('3')).toBeTruthy();
    // employer comparison
    expect(screen.getByText('€144.00')).toBeTruthy();
    expect(screen.getByText('€60.00')).toBeTruthy();
    expect(screen.getByText(/70\.6% of earnings/)).toBeTruthy();
  });

  it('statistics update immediately after a shift is edited', async () => {
    const { db, cafe } = await seed();
    await show(<StatisticsScreen />, db);
    await screen.findByText('€12.75/h');
    await saveShift(db, { employerId: cafe, startAt: at('2026-03-12', '08:00'), endAt: at('2026-03-12', '12:00'), breaks: [], adjustments: [] }, at('2026-03-12', '12:00'));
    // a new shift in the same week: 204.00 + 48.00 = 252.00 over 20 h
    // (the screen reloads when data changes; here the db changed behind its back, so trigger via a new render)
    await show(<StatisticsScreen />, db);
    await waitFor(() => expect(screen.getAllByText('€252.00').length).toBeGreaterThan(0));
  });
});

describe('settings and export', () => {
  it('persists the theme and switches the whole UI to Dutch', async () => {
    const db = await openTestDb();
    await show(<SettingsScreen />, db);
    await fireEvent.press(await screen.findByLabelText('Dark'));
    await waitFor(async () => expect((await loadSettings(db)).theme).toBe('dark'));
    await fireEvent.press(screen.getByLabelText('Nederlands'));
    expect(await screen.findByText('Instellingen')).toBeTruthy();
    await waitFor(async () => expect((await loadSettings(db)).language).toBe('nl'));
    expect(screen.getByText('Exporteren naar CSV')).toBeTruthy();
  });

  it('exports shifts as CSV (European dialect) and hands the file to the share sheet', async () => {
    const { db } = await seed();
    await show(<ExportScreen />, db);
    await fireEvent.press(await screen.findByLabelText('Create and share file'));
    await waitFor(() => expect(mockState.lastCsv).not.toBeNull());
    const lines = mockState.lastCsv!.slice(1).split('\r\n');
    expect(lines[0]).toBe('Date;Employer;Start;End;Unpaid break (min);Paid hours;Counted hours;Earnings for time;Fixed bonuses;Tips;Extras;Total;Currency;Notes');
    expect(lines[1]).toBe('2026-03-09;Café;2026-03-09 09:00;2026-03-09 13:00;0;4,00;4,00;48,00;0,00;0,00;0,00;48,00;EUR;');
    expect(lines).toHaveLength(5); // header + 3 shifts + trailing empty after CRLF
  });
});
