import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, useColorScheme } from 'react-native';

import { ConflictError, NotFoundError, ValidationError } from '@/core/errors';
import { startOfNextLocalDay, toLocalDateString } from '@/core/time';
import type { Db } from '@/db/types';
import { LOCALES, translate, translatePlural } from '@/i18n';
import type { Params, PluralBase, TKey } from '@/i18n';
import { en } from '@/i18n/en';
import { createFormatter } from '@/i18n/format';
import { darkPalette, lightPalette } from '@/theme/tokens';
import type { Palette } from '@/theme/tokens';

import { useApp } from './AppProvider';

/* ------------------------------ theme ------------------------------ */

export function useTheme(): { colors: Palette; isDark: boolean } {
  const { settings } = useApp();
  const system = useColorScheme();
  const isDark = settings.theme === 'system' ? system === 'dark' : settings.theme === 'dark';
  return useMemo(() => ({ colors: isDark ? darkPalette : lightPalette, isDark }), [isDark]);
}

/* ------------------------------ i18n ------------------------------ */

export function useI18n() {
  const { settings } = useApp();
  return useMemo(() => {
    const language = settings.language;
    return {
      language,
      locale: LOCALES[language],
      fmt: createFormatter(LOCALES[language], settings.timeFormat),
      t: (key: TKey, params?: Params) => translate(language, key, params),
      tp: (base: PluralBase, count: number, params?: Params) => translatePlural(language, base, count, params),
    };
  }, [settings.language, settings.timeFormat]);
}
export type I18n = ReturnType<typeof useI18n>;

/** Human readable message for any error thrown by the services. */
export function errorMessage(error: unknown, t: I18n['t']): string {
  let code: string | undefined;
  if (error instanceof ValidationError) code = error.issues[0]?.code;
  else if (error instanceof ConflictError || error instanceof NotFoundError) code = error.code;
  const key = `error.${code}` as TKey;
  return code && key in en ? t(key) : t('error.unknown');
}

/* ------------------------------ data ------------------------------ */

/** Run an async query against the database; re-runs whenever data changes (`version`) or `deps` change. */
export function useQuery<T>(loader: (db: Db) => Promise<T>, deps: readonly unknown[] = []) {
  const { db, version } = useApp();
  const [state, setState] = useState<{ data: T | undefined; error: unknown; loading: boolean }>({ data: undefined, error: undefined, loading: true });
  const [tick, setTick] = useState(0);
  const loaderRef = useRef(loader);
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    let cancelled = false;
    loaderRef.current(db).then(
      (data) => {
        if (!cancelled) setState({ data, error: undefined, loading: false });
      },
      (error) => {
        if (!cancelled) setState((s) => ({ data: s.data, error, loading: false }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [db, version, tick, depsKey]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}

/** Wraps a mutation: reports errors to the user in plain language and refreshes all screens on success. */
export function useActions() {
  const { db, bump } = useApp();
  const { t } = useI18n();
  const run = useCallback(
    async <T>(task: (db: Db) => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> => {
      try {
        const value = await task(db);
        bump();
        return { ok: true, value };
      } catch (error) {
        Alert.alert(t('common.error.title'), errorMessage(error, t));
        return { ok: false, error };
      }
    },
    [db, bump, t],
  );
  return { run, db };
}

/* ------------------------------ time ------------------------------ */

/** Current time, refreshed on every full second while `active`, and instantly when the app returns to the foreground. */
export function useNow(active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      setNow(Date.now());
      timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    };
    timer = setTimeout(tick, 0); // first update right away, then on every full second
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [active]);
  return now;
}

/** The local date ('YYYY-MM-DD'); changes at midnight and when the app returns to the foreground. */
export function useDayKey(): string {
  const [key, setKey] = useState(() => toLocalDateString(Date.now()));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const delay = Math.min(startOfNextLocalDay(Date.now()) - Date.now() + 1000, 2_000_000_000);
      timer = setTimeout(() => {
        setKey(toLocalDateString(Date.now()));
        schedule();
      }, delay);
    };
    schedule();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setKey(toLocalDateString(Date.now()));
    });
    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, []);
  return key;
}

/** Whether the native time picker should use a 24-hour clock. */
export function useIs24Hour(): boolean {
  const { settings } = useApp();
  const { fmt } = useI18n();
  if (settings.timeFormat === '24h') return true;
  if (settings.timeFormat === '12h') return false;
  return !/AM|PM/i.test(fmt.time(new Date(2024, 0, 1, 15).getTime()));
}

/** Current time with minute resolution (cheap): greeting, "now" for rates while no shift is running. */
export function useMinuteNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);
  return now;
}
