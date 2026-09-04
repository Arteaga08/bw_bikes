import type { ReactNode } from "react";
import type { ComparableBike } from "@/lib/api/public-catalog";
import type { ComparisonRow as ComparisonRowData } from "./comparison-rows";

/** A row where every bike is silent renders this dash rather than an empty cell — same rule `comparison-rows.ts` already documents for its own rows. */
export const MISSING = "—";

export interface ComparisonRowShellProps {
  label: string;
  children: ReactNode;
}

/**
 * The one place that defines what a comparator "row" is: a label plus one
 * cell per bike, all sharing the column template `ComparisonTable` publishes
 * as `--comparison-columns` / `--comparison-columns-mobile`.
 * `ComparisonTextRow` below, and `ComparisonImageRow`/`ComparisonColorsRow`
 * in `ComparisonOverviewRows.tsx`, all render through this so a photo row, a
 * swatches row, and a plain spec row never drift out of column alignment
 * from each other.
 *
 * Two layouts, one markup: from `lg` up the label is a real first column
 * (`10rem`, pinned with `sticky left-0`) next to the cells; below `lg` that
 * column would eat most of a phone's width and leave less than one bike
 * visible, so the label goes `col-span-full` *above* the cells and the
 * mobile template drops the label track entirely — every pixel of the strip
 * then belongs to the bikes. The label text is pinned with its own inner
 * `sticky left-0` span (the `dt` itself spans the whole scroll width, so
 * pinning the element would pin nothing), which keeps "Precio", "Colores",
 * etc. readable while the shopper scrolls sideways.
 */
export function ComparisonRowShell({ label, children }: ComparisonRowShellProps) {
  return (
    <div className="grid gap-md border-t border-borde px-md py-md [grid-template-columns:var(--comparison-columns-mobile)] lg:gap-lg lg:px-lg lg:[grid-template-columns:var(--comparison-columns)]">
      <dt className="col-span-full font-body text-caption uppercase text-grafito lg:col-span-1 lg:sticky lg:left-0 lg:bg-blanco">
        <span className="sticky left-0 inline-block bg-blanco pr-sm lg:static lg:pr-0">{label}</span>
      </dt>
      {children}
    </div>
  );
}

export interface ComparisonTextRowProps {
  row: ComparisonRowData;
  bikes: ComparableBike[];
}

/** A plain text spec row — `buildOverviewGroup`'s and `buildComparison`'s bread and butter. */
export function ComparisonTextRow({ row, bikes }: ComparisonTextRowProps) {
  return (
    <ComparisonRowShell label={row.label}>
      {row.values.map((value, index) => (
        <dd key={bikes[index]!.slug} className="font-body text-body text-negro">
          <span className="sr-only">{bikes[index]!.name}: </span>
          {value ?? MISSING}
        </dd>
      ))}
    </ComparisonRowShell>
  );
}
