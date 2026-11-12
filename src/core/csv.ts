/** CSV export (RFC 4180 quoting, spreadsheet formula-injection protection, European dialect support). */

import { formatHoursDecimal, toLocalDateString, toLocalTimeString } from './time';
import { centsToPlainString } from './money';

export type CsvDialect = 'comma' | 'semicolon';

export interface ExportShift {
  startAt: number;
  endAt: number;
  employerName: string;
  currency: string;
  unpaidBreakMs: number;
  paidMs: number;
  roundedMs: number;
  timeCents: number;
  fixedBonusCents: number;
  tipsCents: number;
  extrasCents: number;
  totalCents: number;
  notes: string | null;
}

/** Neutralise cells that spreadsheets would interpret as formulas (= + - @ tab CR). */
export function sanitizeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function quote(value: string, delimiter: string): string {
  if (value.includes('"') || value.includes(delimiter) || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(rows: readonly (readonly string[])[], dialect: CsvDialect): string {
  const delimiter = dialect === 'semicolon' ? ';' : ',';
  return '﻿' + rows.map((r) => r.map((c) => quote(c, delimiter)).join(delimiter)).join('\r\n') + '\r\n';
}

export const CSV_COLUMNS = [
  'date',
  'employer',
  'start',
  'end',
  'unpaidBreakMinutes',
  'paidHours',
  'countedHours',
  'timeEarnings',
  'fixedBonuses',
  'tips',
  'extras',
  'total',
  'currency',
  'notes',
] as const;
export type CsvColumn = (typeof CSV_COLUMNS)[number];

/** Build the CSV text. `headers` maps every column to its (translated) header label. */
export function buildShiftsCsv(rows: readonly ExportShift[], headers: Record<CsvColumn, string>, dialect: CsvDialect): string {
  const decimal = dialect === 'semicolon' ? ',' : '.';
  const money = (cents: number) => centsToPlainString(cents, decimal);
  const table: string[][] = [CSV_COLUMNS.map((c) => headers[c])];
  for (const r of rows) {
    table.push([
      toLocalDateString(r.startAt),
      sanitizeCell(r.employerName),
      `${toLocalDateString(r.startAt)} ${toLocalTimeString(r.startAt)}`,
      `${toLocalDateString(r.endAt)} ${toLocalTimeString(r.endAt)}`,
      String(Math.round(r.unpaidBreakMs / 60_000)),
      formatHoursDecimal(r.paidMs, decimal),
      formatHoursDecimal(r.roundedMs, decimal),
      money(r.timeCents),
      money(r.fixedBonusCents),
      money(r.tipsCents),
      money(r.extrasCents),
      money(r.totalCents),
      r.currency,
      sanitizeCell(r.notes ?? ''),
    ]);
  }
  return toCsv(table, dialect);
}
