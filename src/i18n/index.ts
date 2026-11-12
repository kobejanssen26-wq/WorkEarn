import { en } from './en';
import type { TKey } from './en';
import { nl } from './nl';

export type { TKey };
export type Language = 'en' | 'nl';
export const LANGUAGES: readonly Language[] = ['en', 'nl'];
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', nl: 'Nederlands' };
/** BCP 47 locale used for dates, numbers and currencies. English uses the 24-hour, day-first British style common in Europe. */
export const LOCALES: Record<Language, string> = { en: 'en-GB', nl: 'nl-BE' };

const dictionaries: Record<Language, Record<TKey, string>> = { en, nl };

export type Params = Record<string, string | number>;
export type PluralBase = TKey extends infer K ? (K extends `${infer B}_one` ? B : never) : never;

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function translate(language: Language, key: TKey, params?: Params): string {
  return interpolate(dictionaries[language][key] ?? en[key] ?? key, params);
}

/** Plural-aware lookup: uses `<base>_one` for 1 and `<base>_other` otherwise. */
export function translatePlural(language: Language, base: PluralBase, count: number, params?: Params): string {
  const key = `${base}_${count === 1 ? 'one' : 'other'}` as TKey;
  return translate(language, key, { count, ...params });
}
