/** Database abstractions shared by the app (expo-sqlite) and the automated tests (node:sqlite). */

export type SqlValue = string | number | null;

export interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

/** Minimal asynchronous SQLite driver. Implemented by expo-sqlite (app) and node:sqlite (tests). */
export interface SqlDriver {
  exec(sql: string): Promise<void>;
  run(sql: string, params: SqlValue[]): Promise<RunResult>;
  all<T>(sql: string, params: SqlValue[]): Promise<T[]>;
  close(): Promise<void>;
}

/** Statement executor. Repositories only depend on this, so they run inside or outside a transaction. */
export interface DbExecutor {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<RunResult>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  get<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
}

export interface Db extends DbExecutor {
  /**
   * Run `fn` inside BEGIN IMMEDIATE ... COMMIT. Use ONLY the executor passed to `fn` inside the
   * callback (calling the outer Db would wait for the transaction and deadlock). Rolls back on error.
   */
  transaction<T>(fn: (tx: DbExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
