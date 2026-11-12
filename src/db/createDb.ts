import type { Db, DbExecutor, RunResult, SqlDriver, SqlValue } from './types';

function executorFor(driver: SqlDriver): DbExecutor {
  return {
    exec: (sql) => driver.exec(sql),
    run: (sql, params = []) => driver.run(sql, params),
    all: <T>(sql: string, params: SqlValue[] = []) => driver.all<T>(sql, params),
    get: async <T>(sql: string, params: SqlValue[] = []) => {
      const rows = await driver.all<T>(sql, params);
      return rows.length > 0 ? (rows[0] as T) : null;
    },
  };
}

/**
 * Wraps a driver so that every statement and every transaction runs strictly one after another.
 * This removes interleaving problems between concurrent async callers (e.g. the one second UI tick
 * querying while a shift is being stopped) and gives all-or-nothing transactions.
 */
export function createDb(driver: SqlDriver): Db {
  let tail: Promise<unknown> = Promise.resolve();
  const direct = executorFor(driver);

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task, task);
    tail = result.catch(() => undefined);
    return result;
  }

  return {
    exec: (sql) => enqueue(() => direct.exec(sql)),
    run: (sql, params) => enqueue(() => direct.run(sql, params)) as Promise<RunResult>,
    all: <T>(sql: string, params?: SqlValue[]) => enqueue(() => direct.all<T>(sql, params)),
    get: <T>(sql: string, params?: SqlValue[]) => enqueue(() => direct.get<T>(sql, params)),
    transaction: <T>(fn: (tx: DbExecutor) => Promise<T>) =>
      enqueue(async () => {
        await driver.exec('BEGIN IMMEDIATE');
        try {
          const result = await fn(direct);
          await driver.exec('COMMIT');
          return result;
        } catch (error) {
          try {
            await driver.exec('ROLLBACK');
          } catch {
            // The original error is the interesting one.
          }
          throw error;
        }
      }),
    close: () => enqueue(() => driver.close()),
  };
}
