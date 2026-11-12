import { ValidationError } from '@/core/errors';
import { payRuleSignature, validatePayRule } from '@/core/payRule';
import type { CustomBonus, FixedBonus, FixedBonusCondition, IntervalMinutes, PayRule, Premium, RoundingMode, WeekdayIndex } from '@/core/types';

import type { DbExecutor, SqlValue } from './types';

interface PayRuleRow {
  id: number;
  employer_id: number;
  version: number;
  is_current: number;
  currency: string;
  hourly_rate: number;
  interval_minutes: number;
  rounding_mode: string;
}
interface WeekdayRateRow {
  pay_rule_id: number;
  weekday: number;
  hourly_rate: number;
}
interface BonusRow {
  id: number;
  pay_rule_id: number;
  kind: 'saturday' | 'sunday' | 'holiday' | 'custom';
  name: string;
  value_type: 'percent' | 'amount';
  value: number;
  mode: 'add' | 'replace';
  weekday_mask: number;
  start_minute: number;
  end_minute: number;
}
interface FixedBonusRow {
  id: number;
  pay_rule_id: number;
  name: string;
  amount_cents: number;
  condition: FixedBonusCondition;
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(',');
}

function toPremium(row: BonusRow): Premium {
  return { valueType: row.value_type, value: row.value, mode: row.mode };
}

/** Load complete pay rules (with all children) by id. */
export async function loadPayRules(db: DbExecutor, ids: number[]): Promise<Map<number, PayRule>> {
  const result = new Map<number, PayRule>();
  if (ids.length === 0) return result;
  const ph = placeholders(ids.length);
  const rules = await db.all<PayRuleRow>(`SELECT * FROM pay_rules WHERE id IN (${ph})`, ids);
  const weekdayRates = await db.all<WeekdayRateRow>(`SELECT * FROM pay_rule_weekday_rates WHERE pay_rule_id IN (${ph})`, ids);
  const bonuses = await db.all<BonusRow>(
    `SELECT * FROM pay_rule_bonuses WHERE pay_rule_id IN (${ph}) ORDER BY pay_rule_id, sort_order, id`,
    ids,
  );
  const fixed = await db.all<FixedBonusRow>(
    `SELECT * FROM pay_rule_fixed_bonuses WHERE pay_rule_id IN (${ph}) ORDER BY pay_rule_id, sort_order, id`,
    ids,
  );

  for (const row of rules) {
    const rule: PayRule = {
      id: row.id,
      employerId: row.employer_id,
      version: row.version,
      currency: row.currency,
      hourlyRate: row.hourly_rate,
      weekdayRates: {},
      saturday: null,
      sunday: null,
      holiday: null,
      customBonuses: [],
      fixedBonuses: [],
      intervalMinutes: row.interval_minutes as IntervalMinutes,
      roundingMode: row.rounding_mode as RoundingMode,
    };
    result.set(row.id, rule);
  }
  for (const wr of weekdayRates) {
    const rule = result.get(wr.pay_rule_id);
    if (rule) rule.weekdayRates[wr.weekday as WeekdayIndex] = wr.hourly_rate;
  }
  for (const b of bonuses) {
    const rule = result.get(b.pay_rule_id);
    if (!rule) continue;
    if (b.kind === 'custom') {
      const custom: CustomBonus = {
        ...toPremium(b),
        id: b.id,
        name: b.name,
        weekdayMask: b.weekday_mask,
        startMinute: b.start_minute,
        endMinute: b.end_minute,
      };
      rule.customBonuses.push(custom);
    } else {
      rule[b.kind] = toPremium(b);
    }
  }
  for (const f of fixed) {
    const rule = result.get(f.pay_rule_id);
    if (!rule) continue;
    const bonus: FixedBonus = { id: f.id, name: f.name, amountCents: f.amount_cents, condition: f.condition };
    rule.fixedBonuses.push(bonus);
  }
  return result;
}

export async function loadPayRule(db: DbExecutor, id: number): Promise<PayRule | null> {
  const map = await loadPayRules(db, [id]);
  return map.get(id) ?? null;
}

async function insertChildren(db: DbExecutor, payRuleId: number, rule: PayRule): Promise<void> {
  for (const [day, rate] of Object.entries(rule.weekdayRates)) {
    if (rate === undefined) continue;
    await db.run('INSERT INTO pay_rule_weekday_rates (pay_rule_id, weekday, hourly_rate) VALUES (?, ?, ?)', [
      payRuleId,
      Number(day),
      rate,
    ]);
  }
  const insertBonus = async (kind: string, name: string, p: Premium, mask: number, start: number, end: number, order: number) => {
    const params: SqlValue[] = [payRuleId, kind, name, p.valueType, p.value, p.mode, mask, start, end, order];
    await db.run(
      `INSERT INTO pay_rule_bonuses (pay_rule_id, kind, name, value_type, value, mode, weekday_mask, start_minute, end_minute, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params,
    );
  };
  if (rule.saturday) await insertBonus('saturday', '', rule.saturday, 127, 0, 0, 0);
  if (rule.sunday) await insertBonus('sunday', '', rule.sunday, 127, 0, 0, 0);
  if (rule.holiday) await insertBonus('holiday', '', rule.holiday, 127, 0, 0, 0);
  let order = 0;
  for (const b of rule.customBonuses) {
    await insertBonus('custom', b.name.trim(), b, b.weekdayMask, b.startMinute, b.endMinute, order++);
  }
  order = 0;
  for (const f of rule.fixedBonuses) {
    await db.run(
      'INSERT INTO pay_rule_fixed_bonuses (pay_rule_id, name, amount_cents, condition, sort_order) VALUES (?, ?, ?, ?, ?)',
      [payRuleId, f.name.trim(), f.amountCents, f.condition, order++],
    );
  }
}

export async function insertPayRule(
  db: DbExecutor,
  employerId: number,
  version: number,
  isCurrent: boolean,
  rule: PayRule,
  now: number,
): Promise<number> {
  const issues = validatePayRule(rule);
  if (issues.length > 0) throw new ValidationError(issues);
  const res = await db.run(
    `INSERT INTO pay_rules (employer_id, version, is_current, currency, hourly_rate, interval_minutes, rounding_mode, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [employerId, version, isCurrent ? 1 : 0, rule.currency, rule.hourlyRate, rule.intervalMinutes, rule.roundingMode, now],
  );
  await insertChildren(db, res.lastInsertRowId, rule);
  return res.lastInsertRowId;
}

/**
 * Persist an employer's edited pay rules.
 *  - unchanged            -> nothing happens
 *  - current rule unused  -> edited in place
 *  - current rule used by shifts -> a NEW version becomes current, so those shifts keep the
 *    configuration they were recorded with (historical shifts retain their original pay rules)
 * Must run inside a transaction. Returns the id of the (now) current pay rule.
 */
export async function saveEmployerPayRule(db: DbExecutor, employerId: number, rule: PayRule, now: number): Promise<number> {
  const issues = validatePayRule(rule);
  if (issues.length > 0) throw new ValidationError(issues);

  const current = await db.get<{ id: number; version: number }>(
    'SELECT id, version FROM pay_rules WHERE employer_id = ? AND is_current = 1',
    [employerId],
  );
  if (!current) {
    const latest = await db.get<{ v: number | null }>('SELECT MAX(version) AS v FROM pay_rules WHERE employer_id = ?', [employerId]);
    return insertPayRule(db, employerId, (latest?.v ?? 0) + 1, true, rule, now);
  }

  const existing = await loadPayRule(db, current.id);
  if (existing && payRuleSignature(existing) === payRuleSignature(rule)) return current.id;

  const usage = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM shifts WHERE pay_rule_id = ?', [current.id]);
  if ((usage?.n ?? 0) === 0) {
    await db.run(
      'UPDATE pay_rules SET currency = ?, hourly_rate = ?, interval_minutes = ?, rounding_mode = ? WHERE id = ?',
      [rule.currency, rule.hourlyRate, rule.intervalMinutes, rule.roundingMode, current.id],
    );
    await db.run('DELETE FROM pay_rule_weekday_rates WHERE pay_rule_id = ?', [current.id]);
    await db.run('DELETE FROM pay_rule_bonuses WHERE pay_rule_id = ?', [current.id]);
    await db.run('DELETE FROM pay_rule_fixed_bonuses WHERE pay_rule_id = ?', [current.id]);
    await insertChildren(db, current.id, rule);
    return current.id;
  }

  await db.run('UPDATE pay_rules SET is_current = 0 WHERE id = ?', [current.id]);
  return insertPayRule(db, employerId, current.version + 1, true, rule, now);
}

export async function getCurrentPayRuleId(db: DbExecutor, employerId: number): Promise<number | null> {
  const row = await db.get<{ id: number }>('SELECT id FROM pay_rules WHERE employer_id = ? AND is_current = 1', [employerId]);
  return row?.id ?? null;
}
