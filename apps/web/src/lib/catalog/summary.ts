import type { SummaryRow } from "@bw-bikes/shared";
import { normalizeOrder } from "./spec-groups";

/**
 * Mirror `apps/api/src/models/schemas/product-summary.schema.ts` — redeclared
 * for the same reason the spec caps are (`spec-groups.ts`): `apps/web` never
 * imports `apps/api` source. Used to show the remaining count and block the
 * "add" button before the server has to reject a 400.
 */
export const MAX_SUMMARY_ROWS = 6;

/**
 * The four pure operations the "En pocas palabras" editor needs — add, edit,
 * reorder and delete. Same shape as `spec-groups.ts`'s: plain functions over
 * `SummaryRow[]`, so they're testable without mounting a form, and every
 * mutator ends in that module's `normalizeOrder` so `order` stays a dense
 * `0..n-1` sequence after an insert, a delete in the middle, or a move.
 *
 * Unlike the spec sheet, the summary has no `PUT` of its own: it rides in the
 * bike's own POST/PATCH body (see `ProductEditor`), so nothing here talks to
 * the API either.
 */
export function addRow(rows: SummaryRow[], label: string, value: string): SummaryRow[] {
  if (rows.length >= MAX_SUMMARY_ROWS) return rows;
  return normalizeOrder([...rows, { label, value, order: rows.length }]);
}

export function updateRow(
  rows: SummaryRow[],
  rowIndex: number,
  patch: Partial<Pick<SummaryRow, "label" | "value">>,
): SummaryRow[] {
  return rows.map((row, index) => (index === rowIndex ? { ...row, ...patch } : row));
}

export function removeRow(rows: SummaryRow[], rowIndex: number): SummaryRow[] {
  return normalizeOrder(rows.filter((_, index) => index !== rowIndex));
}

export function moveRow(rows: SummaryRow[], rowIndex: number, direction: -1 | 1): SummaryRow[] {
  const target = rowIndex + direction;
  if (target < 0 || target >= rows.length) return rows;

  const next = [...rows];
  const [moved] = next.splice(rowIndex, 1);
  next.splice(target, 0, moved as SummaryRow);
  return normalizeOrder(next);
}
