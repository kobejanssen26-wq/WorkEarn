import type { Db } from './types';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

/**
 * Schema migrations, applied in order inside a transaction each. The applied version is stored
 * in `PRAGMA user_version`. Never edit a released migration: add a new one.
 *
 * Money: all `*_cents` columns are minor units. Hourly rates (`hourly_rate`, amount based bonus
 * values) are "rate units" = 1/10 000 of a currency unit; percentages are basis points.
 * Timestamps are epoch milliseconds (UTC). `local_date` is the local calendar date of the shift
 * start at the moment it was recorded.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
CREATE TABLE employers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  color TEXT NOT NULL DEFAULT '#10B981',
  notes TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_employers_order ON employers (is_archived, sort_order, id);

CREATE TABLE pay_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employer_id INTEGER NOT NULL REFERENCES employers (id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version >= 1),
  is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0, 1)),
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  hourly_rate INTEGER NOT NULL CHECK (hourly_rate >= 0),
  interval_minutes INTEGER NOT NULL DEFAULT 0 CHECK (interval_minutes IN (0, 1, 5, 10, 15, 30, 60)),
  rounding_mode TEXT NOT NULL DEFAULT 'nearest' CHECK (rounding_mode IN ('down', 'up', 'nearest')),
  created_at INTEGER NOT NULL,
  UNIQUE (employer_id, version)
);
CREATE UNIQUE INDEX idx_pay_rules_current ON pay_rules (employer_id) WHERE is_current = 1;

CREATE TABLE pay_rule_weekday_rates (
  pay_rule_id INTEGER NOT NULL REFERENCES pay_rules (id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  hourly_rate INTEGER NOT NULL CHECK (hourly_rate >= 0),
  PRIMARY KEY (pay_rule_id, weekday)
) WITHOUT ROWID;

CREATE TABLE pay_rule_bonuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pay_rule_id INTEGER NOT NULL REFERENCES pay_rules (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('saturday', 'sunday', 'holiday', 'custom')),
  name TEXT NOT NULL DEFAULT '',
  value_type TEXT NOT NULL CHECK (value_type IN ('percent', 'amount')),
  value INTEGER NOT NULL CHECK (value >= 0),
  mode TEXT NOT NULL CHECK (mode IN ('add', 'replace')),
  weekday_mask INTEGER NOT NULL DEFAULT 127 CHECK (weekday_mask BETWEEN 0 AND 127),
  start_minute INTEGER NOT NULL DEFAULT 0 CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute INTEGER NOT NULL DEFAULT 0 CHECK (end_minute BETWEEN 0 AND 1439),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_pay_rule_bonuses_rule ON pay_rule_bonuses (pay_rule_id, sort_order);
CREATE UNIQUE INDEX idx_pay_rule_bonuses_kind ON pay_rule_bonuses (pay_rule_id, kind) WHERE kind <> 'custom';

CREATE TABLE pay_rule_fixed_bonuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pay_rule_id INTEGER NOT NULL REFERENCES pay_rules (id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  condition TEXT NOT NULL DEFAULT 'always' CHECK (condition IN ('always', 'weekday', 'saturday', 'sunday', 'holiday')),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_pay_rule_fixed_rule ON pay_rule_fixed_bonuses (pay_rule_id, sort_order);

CREATE TABLE shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employer_id INTEGER NOT NULL REFERENCES employers (id) ON DELETE CASCADE,
  pay_rule_id INTEGER NOT NULL REFERENCES pay_rules (id),
  start_at INTEGER NOT NULL,
  end_at INTEGER,
  local_date TEXT NOT NULL CHECK (local_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'live' CHECK (source IN ('live', 'manual')),
  paid_ms INTEGER,
  rounded_ms INTEGER,
  time_cents INTEGER,
  fixed_bonus_cents INTEGER,
  adjustments_cents INTEGER,
  total_cents INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (end_at IS NULL OR end_at >= start_at),
  CHECK ((end_at IS NULL) = (total_cents IS NULL))
);
CREATE UNIQUE INDEX idx_shifts_single_active ON shifts ((1)) WHERE end_at IS NULL;
CREATE INDEX idx_shifts_start ON shifts (start_at);
CREATE INDEX idx_shifts_local_date ON shifts (local_date);
CREATE INDEX idx_shifts_employer_date ON shifts (employer_id, local_date);

CREATE TABLE breaks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id INTEGER NOT NULL REFERENCES shifts (id) ON DELETE CASCADE,
  start_at INTEGER NOT NULL,
  end_at INTEGER,
  is_paid INTEGER NOT NULL DEFAULT 0 CHECK (is_paid IN (0, 1)),
  kind TEXT NOT NULL DEFAULT 'pause' CHECK (kind IN ('pause', 'manual')),
  CHECK (end_at IS NULL OR end_at >= start_at)
);
CREATE INDEX idx_breaks_shift ON breaks (shift_id, start_at);
CREATE UNIQUE INDEX idx_breaks_single_open ON breaks (shift_id) WHERE end_at IS NULL;

CREATE TABLE earnings_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id INTEGER NOT NULL REFERENCES shifts (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('tip', 'extra')),
  label TEXT,
  amount_cents INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_adjustments_shift ON earnings_adjustments (shift_id);

CREATE TABLE holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  holiday_key TEXT,
  region TEXT NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0 CHECK (is_custom IN (0, 1)),
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  UNIQUE (date, region, name)
);
CREATE INDEX idx_holidays_date ON holidays (date);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
) WITHOUT ROWID;
`,
  },
];

export const LATEST_SCHEMA_VERSION = (MIGRATIONS[MIGRATIONS.length - 1] as Migration).version;

/** Connection level settings. Must run outside a transaction, on every connection. */
export const CONNECTION_PRAGMAS = 'PRAGMA foreign_keys = ON;';

export async function getSchemaVersion(db: Db): Promise<number> {
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/** Apply all pending migrations. Throws if the database is newer than this app understands. */
export async function migrate(db: Db): Promise<{ from: number; to: number }> {
  await db.exec(CONNECTION_PRAGMAS);
  const from = await getSchemaVersion(db);
  if (from > LATEST_SCHEMA_VERSION) {
    throw new Error(`Database schema version ${from} is newer than supported version ${LATEST_SCHEMA_VERSION}`);
  }
  let current = from;
  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    await db.transaction(async (tx) => {
      await tx.exec(migration.sql);
      await tx.exec(`PRAGMA user_version = ${migration.version}`);
    });
    current = migration.version;
  }
  return { from, to: current };
}
