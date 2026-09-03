import type { ReactNode } from "react";
import type { ComparableBike } from "@/lib/api/public-catalog";
import type { ComparisonRow as ComparisonRowData } from "./comparison-rows";

/** A row where every bike is silent renders this dash rather than an empty cell — same rule `comparison-rows.ts` already documents for its own rows. */
export const MISSING = "—";

export interface ComparisonRowShellProps {
  label: string;
  /** Shares `ComparisonTable`'s column template so every row — text, image, or swatches — stays aligned as the table scrolls horizontally. */
  gridTemplateColumns: string;
  children: ReactNode;
}

/**
 * The one place that defines what a comparator "row" is: a label column plus
 * one cell per bike, all sharing the same grid track. `ComparisonTextRow`
 * below, and `ComparisonImageRow`/`ComparisonColorsRow` in
 * `ComparisonOverviewRows.tsx`, all render through this so a photo row, a
 * swatches row, and a plain spec row never drift out of column alignment
 * from each other.
 */
export function ComparisonRowShell({ label, gridTemplateColumns, children }: ComparisonRowShellProps) {
  return (
    <div className="grid gap-lg border-t border-borde px-lg py-md" style={{ gridTemplateColumns }}>
      <dt className="sticky left-0 bg-blanco font-body text-caption uppercase text-grafito">{label}</dt>
      {children}
    </div>
  );
}

export interface ComparisonTextRowProps {
  row: ComparisonRowData;
  bikes: ComparableBike[];
  gridTemplateColumns: string;
}

/** A plain text spec row — `buildOverviewGroup`'s and `buildComparison`'s bread and butter. */
export function ComparisonTextRow({ row, bikes, gridTemplateColumns }: ComparisonTextRowProps) {
  return (
    <ComparisonRowShell label={row.label} gridTemplateColumns={gridTemplateColumns}>
      {row.values.map((value, index) => (
        <dd key={bikes[index]!.slug} className="font-body text-body text-negro">
          <span className="sr-only">{bikes[index]!.name}: </span>
          {value ?? MISSING}
        </dd>
      ))}
    </ComparisonRowShell>
  );
}
