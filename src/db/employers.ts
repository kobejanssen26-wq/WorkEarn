import { ValidationError } from '@/core/errors';
import type { PayRule } from '@/core/types';

import { loadPayRules, saveEmployerPayRule } from './payRules';
import type { Db, DbExecutor } from './types';

export interface Employer {
  id: number;
  name: string;
  color: string;
  notes: string | null;
  isArchived: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface EmployerWithRule extends Employer {
  /** Id of the current pay rule version. */
  payRuleId: number;
  rule: PayRule;
  currency: string;
}

export interface EmployerInput {
  name: string;
  color: string;
  notes?: string | null;
}

interface EmployerRow {
  id: number;
  name: string;
  color: string;
  notes: string | null;
  is_archived: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

function toEmployer(row: EmployerRow): Employer {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    notes: row.notes,
    isArchived: row.is_archived === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateEmployerInput(input: EmployerInput): void {
  if (input.name.trim().length === 0) throw new ValidationError([{ field: 'name', code: 'name_required' }]);
  if (input.name.trim().length > 60) throw new ValidationError([{ field: 'name', code: 'name_too_long' }]);
  if (!/^#[0-9A-Fa-f]{6}$/.test(input.color)) throw new ValidationError([{ field: 'color', code: 'color_invalid' }]);
}

export async function listEmployers(db: DbExecutor, options: { includeArchived?: boolean } = {}): Promise<EmployerWithRule[]> {
  const rows = await db.all<EmployerRow>(
    `SELECT * FROM employers ${options.includeArchived ? '' : 'WHERE is_archived = 0'} ORDER BY is_archived, sort_order, id`,
  );
  if (rows.length === 0) return [];
  const current = await db.all<{ id: number; employer_id: number }>('SELECT id, employer_id FROM pay_rules WHERE is_current = 1');
  const rules = await loadPayRules(
    db,
    current.map((c) => c.id),
  );
  const ruleByEmployer = new Map(current.map((c) => [c.employer_id, c.id]));
  const result: EmployerWithRule[] = [];
  for (const row of rows) {
    const ruleId = ruleByEmployer.get(row.id);
    const rule = ruleId === undefined ? undefined : rules.get(ruleId);
    if (!rule || ruleId === undefined) continue; // an employer always has a current rule; skip corrupt rows defensively
    result.push({ ...toEmployer(row), payRuleId: ruleId, rule, currency: rule.currency });
  }
  return result;
}

export async function getEmployer(db: DbExecutor, id: number): Promise<EmployerWithRule | null> {
  const all = await listEmployers(db, { includeArchived: true });
  return all.find((e) => e.id === id) ?? null;
}

export async function createEmployer(db: Db, input: EmployerInput, rule: PayRule, now: number): Promise<number> {
  validateEmployerInput(input);
  return db.transaction(async (tx) => {
    const next = await tx.get<{ n: number }>('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM employers');
    const res = await tx.run(
      'INSERT INTO employers (name, color, notes, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [input.name.trim(), input.color, input.notes?.trim() || null, next?.n ?? 0, now, now],
    );
    await saveEmployerPayRule(tx, res.lastInsertRowId, rule, now);
    return res.lastInsertRowId;
  });
}

export async function updateEmployer(db: Db, id: number, input: EmployerInput, rule: PayRule, now: number): Promise<void> {
  validateEmployerInput(input);
  await db.transaction(async (tx) => {
    const res = await tx.run('UPDATE employers SET name = ?, color = ?, notes = ?, updated_at = ? WHERE id = ?', [
      input.name.trim(),
      input.color,
      input.notes?.trim() || null,
      now,
      id,
    ]);
    if (res.changes === 0) throw new ValidationError([{ field: 'id', code: 'not_found' }]);
    await saveEmployerPayRule(tx, id, rule, now);
  });
}

export async function setEmployerArchived(db: DbExecutor, id: number, archived: boolean, now: number): Promise<void> {
  await db.run('UPDATE employers SET is_archived = ?, updated_at = ? WHERE id = ?', [archived ? 1 : 0, now, id]);
}

export async function countEmployerShifts(db: DbExecutor, id: number): Promise<number> {
  const row = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM shifts WHERE employer_id = ?', [id]);
  return row?.n ?? 0;
}

/** Permanently delete an employer together with all its shifts, breaks, adjustments and pay rules. */
export async function deleteEmployer(db: Db, id: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM shifts WHERE employer_id = ?', [id]);
    await tx.run('DELETE FROM employers WHERE id = ?', [id]);
  });
}
