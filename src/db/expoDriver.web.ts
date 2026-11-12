/**
 * WEB PREVIEW ONLY. Metro resolves `*.web.ts` for the web platform exclusively, so this file (and sql.js,
 * and the preview seed) is never part of the Android app. It lets `expo export --platform web` run the real
 * screens against an in-memory SQLite database; used to generate Play Store screenshots (scripts/store/).
 */
import initSqlJs from 'sql.js';

import { createDb } from './createDb';
import { migrate } from './migrations';
import type { Db, RunResult, SqlDriver, SqlValue } from './types';

export const DATABASE_NAME = 'workearn.db';

async function openSqlJsDriver(): Promise<SqlDriver> {
  const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
  const database = new SQL.Database();
  return {
    exec: async (sql) => {
      database.exec(sql);
    },
    run: async (sql, params): Promise<RunResult> => {
      database.run(sql, params as SqlValue[]);
      const id = database.exec('SELECT last_insert_rowid() AS id');
      return { changes: database.getRowsModified(), lastInsertRowId: Number(id[0]?.values[0]?.[0] ?? 0) };
    },
    all: async <T>(sql: string, params: SqlValue[]) => {
      const stmt = database.prepare(sql);
      try {
        stmt.bind(params);
        const rows: T[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject() as T);
        return rows;
      } finally {
        stmt.free();
      }
    },
    close: async () => {
      database.close();
    },
  };
}

export async function openAppDatabase(): Promise<Db> {
  const db = createDb(await openSqlJsDriver());
  await migrate(db);
  const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
  if (params.get('demo') === '1') {
    const { seedPreviewData } = await import('../preview/seed');
    await seedPreviewData(db, params.get('lang') === 'nl' ? 'nl' : 'en');
  }
  return db;
}
