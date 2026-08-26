import type { ComparableBike } from "@/lib/api/public-catalog";

export interface ComparisonRow {
  label: string;
  /** `undefined` means that bike has no value for this label — the UI renders an em dash, never an empty cell. */
  left?: string;
  right?: string;
}

export interface ComparisonGroup {
  title: string;
  rows: ComparisonRow[];
}

/**
 * Aligns two bikes' spec sheets into shared rows.
 *
 * The embedded `specGroupSchema` on `Bike` is free-form — an admin can type
 * any group title and any field label per product. In practice they line up,
 * because the editor prefills from `SpecTemplate`
 * (`apps/api/src/models/spec-template.model.ts`) and *learns* a label the
 * first time it's used, so "Transmisión → Grupo" means the same thing on
 * every bike. But nothing in the schema enforces that, so this function
 * treats alignment as likely, never as guaranteed: it unions both sides and
 * leaves a hole where one bike is silent.
 *
 * Order follows the left bike — the visitor's own first pick is the spine of
 * the table — with anything only the right bike has appended after it, per
 * group. Matching is exact on the trimmed label; deliberately not
 * case-insensitive or fuzzy, because collapsing "Peso" and "peso" into one
 * row would also collapse two genuinely different labels the day an admin
 * means them differently, and a wrong row is worse than a duplicated one.
 *
 * A row where **both** sides are missing is dropped: it can only come from a
 * label that exists with an empty value, and an all-dash row is noise.
 */
export function buildComparison(left: ComparableBike, right: ComparableBike): ComparisonGroup[] {
  const rightByTitle = new Map(right.specGroups.map((group) => [group.title, group]));
  const seenTitles = new Set<string>();
  const groups: ComparisonGroup[] = [];

  for (const leftGroup of left.specGroups) {
    seenTitles.add(leftGroup.title);
    const rightGroup = rightByTitle.get(leftGroup.title);
    groups.push({
      title: leftGroup.title,
      rows: mergeRows(leftGroup.fields, rightGroup?.fields ?? []),
    });
  }

  // Apartados que solo trae la bici derecha: van al final, con la columna
  // izquierda vacía, en lugar de desaparecer sin que el visitante lo note.
  for (const rightGroup of right.specGroups) {
    if (seenTitles.has(rightGroup.title)) continue;
    groups.push({
      title: rightGroup.title,
      rows: mergeRows([], rightGroup.fields),
    });
  }

  return groups.filter((group) => group.rows.length > 0);
}

type Field = { label: string; value: string };

function mergeRows(leftFields: Field[], rightFields: Field[]): ComparisonRow[] {
  const rightByLabel = new Map(rightFields.map((field) => [field.label.trim(), field]));
  const seenLabels = new Set<string>();
  const rows: ComparisonRow[] = [];

  for (const field of leftFields) {
    const label = field.label.trim();
    seenLabels.add(label);
    rows.push({
      label,
      ...(field.value.trim() ? { left: field.value.trim() } : {}),
      ...(rightByLabel.get(label)?.value.trim() ? { right: rightByLabel.get(label)!.value.trim() } : {}),
    });
  }

  for (const field of rightFields) {
    const label = field.label.trim();
    if (seenLabels.has(label)) continue;
    rows.push({
      label,
      ...(field.value.trim() ? { right: field.value.trim() } : {}),
    });
  }

  return rows.filter((row) => row.left !== undefined || row.right !== undefined);
}
