import { HOLIDAY_REGIONS } from '@/core/holidays';
import type { HolidayRegion } from '@/core/holidays';
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from '@/core/payRule';

import type { DbExecutor } from './types';

export type ThemePreference = 'system' | 'light' | 'dark';
export type Language = 'en' | 'nl';
export type TimeFormat = 'auto' | '24h' | '12h';
export type CsvFormat = 'semicolon' | 'comma';

export interface AppSettings {
  theme: ThemePreference;
  language: Language;
  /** Default currency suggested for new employers. */
  currency: string;
  holidayRegion: HolidayRegion;
  /** 0 = Monday, 6 = Sunday. */
  weekStart: 0 | 6;
  timeFormat: TimeFormat;
  keepAwake: boolean;
  /** New pauses are paid breaks by default. */
  pausePaidByDefault: boolean;
  /** Mask the amounts on the Home screen. */
  hideAmounts: boolean;
  showCents: boolean;
  csvFormat: CsvFormat;
  /** Last employer selected on Home. */
  lastEmployerId: number | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  language: 'en',
  currency: DEFAULT_CURRENCY,
  holidayRegion: 'BE',
  weekStart: 0,
  timeFormat: 'auto',
  keepAwake: false,
  pausePaidByDefault: false,
  hideAmounts: false,
  showCents: true,
  csvFormat: 'semicolon',
  lastEmployerId: null,
};

type Parser<K extends keyof AppSettings> = (raw: string) => AppSettings[K] | undefined;

const bool = (raw: string): boolean | undefined => (raw === '1' ? true : raw === '0' ? false : undefined);
const oneOf =
  <T extends string>(values: readonly T[]) =>
  (raw: string): T | undefined =>
    (values as readonly string[]).includes(raw) ? (raw as T) : undefined;

const PARSERS: { [K in keyof AppSettings]: Parser<K> } = {
  theme: oneOf(['system', 'light', 'dark'] as const),
  language: oneOf(['en', 'nl'] as const),
  currency: (raw) => ((SUPPORTED_CURRENCIES as readonly string[]).includes(raw) ? raw : undefined),
  holidayRegion: oneOf(HOLIDAY_REGIONS),
  weekStart: (raw) => (raw === '0' ? 0 : raw === '6' ? 6 : undefined),
  timeFormat: oneOf(['auto', '24h', '12h'] as const),
  keepAwake: bool,
  pausePaidByDefault: bool,
  hideAmounts: bool,
  showCents: bool,
  csvFormat: oneOf(['semicolon', 'comma'] as const),
  lastEmployerId: (raw) => {
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  },
};

function serialize(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? '1' : '0';
  return String(value);
}

/** Load all settings; unknown or corrupt values silently fall back to the defaults. */
export async function loadSettings(db: DbExecutor): Promise<AppSettings> {
  const rows = await db.all<{ key: string; value: string }>('SELECT key, value FROM app_settings');
  const settings: AppSettings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    const key = row.key as keyof AppSettings;
    const parser = PARSERS[key] as Parser<typeof key> | undefined;
    if (!parser) continue;
    const parsed = parser(row.value);
    if (parsed !== undefined) (settings as unknown as Record<string, unknown>)[key] = parsed;
  }
  return settings;
}

export async function saveSetting<K extends keyof AppSettings>(db: DbExecutor, key: K, value: AppSettings[K], now: number): Promise<void> {
  const raw = serialize(value);
  if (raw === null) {
    await db.run('DELETE FROM app_settings WHERE key = ?', [key]);
    return;
  }
  await db.run(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, raw, now],
  );
}
