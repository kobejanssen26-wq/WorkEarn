import fs from 'node:fs';
import path from 'node:path';

import { HOLIDAY_NAMES_EN, HOLIDAY_REGIONS } from '@/core/holidays';
import { INTERVAL_OPTIONS } from '@/core/types';
import { translate, translatePlural } from '@/i18n';
import { en } from '@/i18n/en';
import { nl } from '@/i18n/nl';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('translations', () => {
  it('Dutch has exactly the same keys as English', () => {
    expect(Object.keys(nl).sort()).toEqual(Object.keys(en).sort());
  });

  it('has no empty strings and identical placeholders in every language', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim().length).toBeGreaterThan(0);
      const dutch = (nl as Record<string, string>)[key]!;
      expect(dutch.trim().length).toBeGreaterThan(0);
      expect({ key, placeholders: placeholders(dutch) }).toEqual({ key, placeholders: placeholders(value) });
    }
  });

  it('translates every built-in holiday, region, interval and weekday', () => {
    const wanted = [
      ...Object.keys(HOLIDAY_NAMES_EN).map((k) => `holiday.${k}`),
      ...HOLIDAY_REGIONS.map((r) => `holidays.region.${r}`),
      ...INTERVAL_OPTIONS.map((i) => `interval.${i}`),
      ...[0, 1, 2, 3, 4, 5, 6].map((d) => `employer.weekday.${d}`),
    ];
    const missing = wanted.filter((k) => !(k in en));
    expect(missing).toEqual([]);
  });

  it('has a message for every error code the core, db, service and form layers can raise', () => {
    const roots = ['src/core', 'src/db', 'src/services', 'src/features/employers'].map((p) => path.join(__dirname, '..', p));
    const codes = new Set<string>();
    const scan = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) scan(full);
        else if (/\.tsx?$/.test(entry.name)) {
          const text = fs.readFileSync(full, 'utf8');
          for (const m of text.matchAll(/(?:code:\s*|new (?:ConflictError|NotFoundError)\(\s*|errors\[[^\]]+\]\s*=\s*)'([a-z_]+)'/g)) codes.add(m[1]!);
        }
      }
    };
    roots.forEach(scan);
    expect(codes.size).toBeGreaterThan(20);
    const missing = [...codes].filter((c) => !(`error.${c}` in en));
    expect(missing).toEqual([]);
  });

  it('interpolates and pluralises', () => {
    expect(translate('en', 'home.since', { time: '09:00' })).toBe('Since 09:00');
    expect(translate('nl', 'home.since', { time: '09:00' })).toBe('Sinds 09:00');
    expect(translatePlural('en', 'history.shiftCount', 1)).toBe('1 shift');
    expect(translatePlural('en', 'history.shiftCount', 3)).toBe('3 shifts');
    expect(translatePlural('nl', 'employer.delete.body', 1)).toContain('1 shift definitief');
  });
});
