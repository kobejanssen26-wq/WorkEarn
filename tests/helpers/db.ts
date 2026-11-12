/* Test helpers: a real SQLite engine (node:sqlite) behind the same Db wrapper the app uses. */
import { createDb } from '@/db/createDb';
import { createEmployer } from '@/db/employers';
import { migrate } from '@/db/migrations';
import type { Db, SqlDriver } from '@/db/types';
import { defaultPayRule } from '@/core/payRule';
import type { PayRule } from '@/core/types';
import { localDateToMs } from '@/core/time';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite');

export function createNodeDriver(path = ':memory:'): SqlDriver {
  const database = new DatabaseSync(path);
  return {
    exec: async (sql) => {
      database.exec(sql);
    },
    run: async (sql, params) => {
      const r = database.prepare(sql).run(...params);
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    all: async <T>(sql: string, params: (string | number | null)[]) => database.prepare(sql).all(...params) as T[],
    close: async () => {
      database.close();
    },
  };
}

/** Open (and migrate) a database. Pass a file path to test persistence across "app restarts". */
export async function openTestDb(path?: string): Promise<Db> {
  const db = createDb(createNodeDriver(path));
  await migrate(db);
  return db;
}

/** Epoch ms of a local date + 'HH:MM'. */
export function at(date: string, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return localDateToMs(date, h * 60 + m);
}

export const MIN = 60_000;
export const HOUR = 3_600_000;
export const T0 = at('2026-01-01', '00:00');

/** EUR 12.00 per hour, continuous, nearest. */
export function rule(over: Partial<PayRule> = {}): PayRule {
  return { ...defaultPayRule('EUR', 120_000), ...over };
}

export async function makeEmployer(db: Db, name = 'Acme Café', payRule: PayRule = rule(), now = T0): Promise<number> {
  return createEmployer(db, { name, color: '#10B981' }, payRule, now);
}
