import type { ComparableBike } from "@/lib/api/public-catalog";
import { formatCurrencyCents } from "@/lib/format";

export interface ComparisonRow {
  label: string;
  /** Parallel to the `bikes` array passed to `buildComparison`/`buildOverviewGroup` — `undefined` at an index means that bike is silent on this label, and the table renders "—" there, never an empty cell. */
  values: (string | undefined)[];
}

export interface ComparisonGroup {
  title: string;
  rows: ComparisonRow[];
}

/**
 * Aligns up to `MAX_COMPARISON_ENTRIES` bikes' spec sheets into shared rows.
 *
 * The embedded `specGroupSchema` on `Bike` is free-form — an admin can type
 * any group title and any field label per product. In practice they line up,
 * because the editor prefills from `SpecTemplate`
 * (`apps/api/src/models/spec-template.model.ts`) and *learns* a label the
 * first time it's used, so "Transmisión → Grupo" means the same thing on
 * every bike. But nothing in the schema enforces that, so this function
 * treats alignment as likely, never as guaranteed: it unions every bike's
 * groups/fields and leaves a hole where a bike is silent.
 *
 * Order follows the **first** bike — the visitor's own first pick is the
 * spine of the table — with whatever only a later bike brings appended after
 * it, in that bike's own order, per group and within each group's rows.
 * Matching is exact on the trimmed label; deliberately not case-insensitive
 * or fuzzy, because collapsing "Peso" and "peso" into one row would also
 * collapse two genuinely different labels the day an admin means them
 * differently, and a wrong row is worse than a duplicated one.
 *
 * A row where **every** bike is silent is dropped (only reachable from a
 * label that exists with a blank value — an all-dash row is noise), and so
 * is a group left with no rows at all.
 */
export function buildComparison(bikes: ComparableBike[]): ComparisonGroup[] {
  const groups: ComparisonGroup[] = [];
  const seenTitles = new Set<string>();

  for (const bike of bikes) {
    for (const group of bike.specGroups) {
      if (seenTitles.has(group.title)) continue;
      seenTitles.add(group.title);
      groups.push({ title: group.title, rows: mergeRows(bikes, group.title) });
    }
  }

  return groups.filter((group) => group.rows.length > 0);
}

type Field = { label: string; value: string };

function fieldsForGroup(bike: ComparableBike, groupTitle: string): Field[] {
  return bike.specGroups.find((group) => group.title === groupTitle)?.fields ?? [];
}

function mergeRows(bikes: ComparableBike[], groupTitle: string): ComparisonRow[] {
  const rows: ComparisonRow[] = [];
  const seenLabels = new Set<string>();

  for (const bike of bikes) {
    for (const field of fieldsForGroup(bike, groupTitle)) {
      const label = field.label.trim();
      if (seenLabels.has(label)) continue;
      seenLabels.add(label);

      const values = bikes.map((candidate) => {
        const match = fieldsForGroup(candidate, groupTitle).find((candidateField) => candidateField.label.trim() === label);
        const value = match?.value.trim();
        return value ? value : undefined;
      });
      if (values.every((value) => value === undefined)) continue;
      rows.push({ label, values });
    }
  }

  return rows;
}

/**
 * The fixed row block above the free-form ficha técnica — año del modelo,
 * precio, precio anterior y tallas disponibles, the four facts every bike
 * carries regardless of what its admin-authored spec sheet does or doesn't
 * cover. Same "drop a row nobody has a value for" rule as `buildComparison`'s
 * rows — reachable here when no bike in the comparison carries a
 * `compareAtPrice`, or (bikes with no sized variants) a `sizes` list.
 */
export function buildOverviewGroup(bikes: ComparableBike[]): ComparisonGroup {
  const rows: ComparisonRow[] = [
    { label: "Año del modelo", values: bikes.map((bike) => (bike.modelYear !== undefined ? String(bike.modelYear) : undefined)) },
    { label: "Precio", values: bikes.map((bike) => formatCurrencyCents(bike.price)) },
    {
      label: "Precio anterior",
      values: bikes.map((bike) => (bike.compareAtPrice !== undefined ? formatCurrencyCents(bike.compareAtPrice) : undefined)),
    },
    { label: "Tallas disponibles", values: bikes.map((bike) => (bike.sizes.length > 0 ? bike.sizes.join(" · ") : undefined)) },
  ].filter((row) => row.values.some((value) => value !== undefined));

  return { title: "Ficha general", rows };
}
