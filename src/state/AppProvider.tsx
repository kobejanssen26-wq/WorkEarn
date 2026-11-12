import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { openAppDatabase } from '@/db/expoDriver';
import { loadSettings, saveSetting } from '@/db/settings';
import type { AppSettings } from '@/db/settings';
import type { Db } from '@/db/types';
import { resetAllData, seedHolidays } from '@/services/data';

interface AppContextValue {
  db: Db;
  settings: AppSettings;
  /** Increases after every data change; screens re-query when it changes. */
  version: number;
  bump: () => void;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  resetAll: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

type Boot = { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready' };

/**
 * Opens the on-device database (running migrations), loads the settings and seeds the holiday
 * calendar before rendering the app. The native splash screen stays visible until `onReady`.
 */
export function AppProvider({
  children,
  onReady,
  renderError,
}: {
  children: ReactNode;
  onReady?: () => void;
  renderError: (error: unknown, retry: () => void) => ReactNode;
}) {
  const [boot, setBoot] = useState<Boot>({ status: 'loading' });
  const [db, setDb] = useState<Db | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [version, setVersion] = useState(0);
  const readyCalled = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const opened = await openAppDatabase();
        const loaded = await loadSettings(opened);
        await seedHolidays(opened, loaded.holidayRegion, new Date().getFullYear());
        if (cancelled) return;
        setDb(opened);
        setSettings(loaded);
        setBoot({ status: 'ready' });
      } catch (error) {
        if (!cancelled) setBoot({ status: 'error', error });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    if (boot.status !== 'loading' && !readyCalled.current) {
      readyCalled.current = true;
      onReady?.();
    }
  }, [boot.status, onReady]);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const updateSetting = useCallback(
    async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      if (!db) return;
      await saveSetting(db, key, value, Date.now());
      setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    [db],
  );

  const resetAll = useCallback(async () => {
    if (!db) return;
    await resetAllData(db);
    const fresh = await loadSettings(db);
    await seedHolidays(db, fresh.holidayRegion, new Date().getFullYear());
    setSettings(fresh);
    setVersion((v) => v + 1);
  }, [db]);

  const value = useMemo<AppContextValue | null>(
    () => (db && settings ? { db, settings, version, bump, updateSetting, resetAll } : null),
    [db, settings, version, bump, updateSetting, resetAll],
  );

  if (boot.status === 'error') return <>{renderError(boot.error, () => setAttempt((a) => a + 1))}</>;
  if (!value) return null;
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
