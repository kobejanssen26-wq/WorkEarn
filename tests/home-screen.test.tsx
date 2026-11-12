import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import HomeScreen from '@/features/home/HomeScreen';
import { AppProvider } from '@/state/AppProvider';
import { getActiveShift, listShifts } from '@/db/shifts';
import { startShift } from '@/services/shifts';
import { HOUR, at, makeEmployer, openTestDb, rule } from './helpers/db';
import { mockState } from './helpers/mockState';

/** A controllable clock: Date.now() returns `clock.now`, so the live ticker can be advanced instantly. */
const clock = { now: at('2026-03-10', '09:00') };

beforeEach(() => {
  jest.spyOn(Date, 'now').mockImplementation(() => clock.now);
  clock.now = at('2026-03-10', '09:00');
  mockState.router.push.mockClear();
});
afterEach(() => {
  jest.restoreAllMocks();
});

async function renderHome() {
  await render(
    <AppProvider renderError={(error) => <>{String(error)}</>}>
      <HomeScreen />
    </AppProvider>,
  );
}

/** The ticker re-reads Date.now() on every full second; wait (real time) until it has done so. */
async function tick(to: number) {
  clock.now = to;
  await act(async () => {
    await new Promise((r) => setTimeout(r, 1100));
  });
}

describe('Home screen with a real SQLite database', () => {
  it('asks the user to add an employer when there is none', async () => {
    mockState.db = await openTestDb();
    await renderHome();
    expect(await screen.findByText('Add your first employer')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Add employer'));
    expect(mockState.router.push).toHaveBeenCalledWith('/employers/new');
  });

  it('runs a whole shift: live earnings, pause, resume, stop and saved result', async () => {
    const db = await openTestDb();
    await makeEmployer(db, 'Café Central', rule({ hourlyRate: 120_000 }));
    mockState.db = db;
    await renderHome();

    expect(await screen.findByText('Café Central')).toBeTruthy();
    expect(screen.getByLabelText('Live earnings: €0.00')).toBeTruthy();
    expect(screen.getByText('€12.00/h')).toBeTruthy();

    // start
    await fireEvent.press(screen.getByLabelText('Start shift'));
    await waitFor(() => expect(screen.getByText('Live')).toBeTruthy());
    expect((await getActiveShift(db))?.startAt).toBe(at('2026-03-10', '09:00'));

    // 29 minutes later the live display shows exactly EUR 5.80 and 0:29:00 worked
    await tick(at('2026-03-10', '09:29'));
    expect(screen.getByLabelText('Live earnings: €5.80')).toBeTruthy();
    expect(screen.getByText('0:29:00')).toBeTruthy();

    // pause: the amount stops growing
    await fireEvent.press(screen.getByLabelText('Pause'));
    await waitFor(() => expect(screen.getByText('Paused')).toBeTruthy());
    await tick(at('2026-03-10', '09:59'));
    expect(screen.getByLabelText('Live earnings: €5.80')).toBeTruthy();

    // resume and work 31 more minutes -> 60 minutes in total
    await fireEvent.press(screen.getByLabelText('Resume'));
    await waitFor(() => expect(screen.getByText('Live')).toBeTruthy());
    await tick(at('2026-03-10', '10:30'));
    expect(screen.getByLabelText('Live earnings: €12.00')).toBeTruthy();

    // stop shows the live estimate next to the final earnings, then saves
    await fireEvent.press(screen.getByLabelText('Stop'));
    expect(await screen.findByText('Final earnings')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Stop and save'));
    await waitFor(async () => expect(await getActiveShift(db)).toBeNull());
    const saved = await listShifts(db);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ totalCents: 1200, roundedMs: HOUR, endAt: at('2026-03-10', '10:30') });
    expect(await screen.findByText('Start shift')).toBeTruthy();
  });

  it('restores a running shift after the app was closed or killed', async () => {
    const db = await openTestDb();
    const emp = await makeEmployer(db, 'Night Shop', rule({ hourlyRate: 150_000 }));
    await startShift(db, emp, at('2026-03-10', '08:00')); // started before the "app restart"
    clock.now = at('2026-03-10', '10:00');
    mockState.db = db;
    await renderHome();
    expect(await screen.findByText('Live')).toBeTruthy();
    expect(screen.getByText('2:00:00')).toBeTruthy();
    expect(screen.getByLabelText('Live earnings: €30.00')).toBeTruthy();
    expect(screen.queryByLabelText('Start shift')).toBeNull();
  });

  it('applies the employer rounding only to the final result, not the live estimate', async () => {
    const db = await openTestDb();
    await makeEmployer(db, 'Quarter Co', rule({ hourlyRate: 120_000, intervalMinutes: 15, roundingMode: 'down' }));
    mockState.db = db;
    await renderHome();
    await screen.findByText('Quarter Co');
    await fireEvent.press(screen.getByLabelText('Start shift'));
    await waitFor(() => expect(screen.getByText('Live')).toBeTruthy());
    await tick(at('2026-03-10', '09:29'));
    expect(screen.getByLabelText('Live earnings: €5.80')).toBeTruthy(); // live: exact
    await fireEvent.press(screen.getByLabelText('Stop'));
    expect((await screen.findAllByText('€3.00')).length).toBe(2); // pay for the counted 15 minutes + final earnings
    await fireEvent.press(screen.getByLabelText('Stop and save'));
    await waitFor(async () => expect((await listShifts(db))[0]?.totalCents).toBe(300));
      });
});
