import * as SQLite from 'expo-sqlite';

import { createDb } from './createDb';
import { migrate } from './migrations';
import type { Db, SqlDriver } from './types';

export const DATABASE_NAME = 'workearn.db';

/** Production driver backed by expo-sqlite (a bundled SQLite build, no system dependency). */
export async function openExpoDriver(name: string = DATABASE_NAME): Promise<SqlDriver> {
  const database = await SQLite.openDatabaseAsync(name);
  return {
    exec: (sql) => database.execAsync(sql),
    run: async (sql, params) => {
      const result = await database.runAsync(sql, params);
      return { changes: result.changes, lastInsertRowId: result.lastInsertRowId };
    },
    all: <T>(sql: string, params: (string | number | null)[]) => database.getAllAsync<T>(sql, params),
    close: () => database.closeAsync(),
  };
}

/** Open the on-device database, enable WAL + foreign keys and migrate to the latest schema. */
export async function openAppDatabase(name: string = DATABASE_NAME): Promise<Db> {
  const driver = await openExpoDriver(name);
  const db = createDb(driver);
  await db.exec('PRAGMA journal_mode = WAL;');
  await migrate(db);
  return db;
}
