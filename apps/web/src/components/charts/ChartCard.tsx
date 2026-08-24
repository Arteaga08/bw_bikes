import type { ReactNode } from "react";

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Renders `emptyMessage` instead of `children` — a chart with zero rows to plot reads as broken, not empty, without an explicit state for it. */
  empty?: boolean;
  emptyMessage?: string;
}

/**
 * The shared shell every chart in the panel sits inside — title, optional
 * subtitle, and a horizontally-scrolling body (a chart is exactly the kind
 * of wide content the responsive rule requires never overflow the page).
 *
 * `h-full` + `flex-1` on the body: a grid row (`HomeStats.tsx`'s
 * `xl:grid-cols-2`) stretches every card in it to the row's tallest sibling
 * by default, but this card's own content used to stay top-anchored inside
 * that taller box — a short empty-state message left visible dead space at
 * the bottom instead of centering in the height it was actually given.
 */
export function ChartCard({ title, subtitle, children, empty, emptyMessage }: ChartCardProps) {
  return (
    <div className="flex h-full flex-col gap-md rounded-card border border-borde bg-surface p-lg">
      <div className="flex flex-col gap-xs">
        <h3 className="font-display text-h3 text-negro">{title}</h3>
        {subtitle ? <p className="font-body text-caption text-grafito">{subtitle}</p> : null}
      </div>
      {empty ? (
        <p className="flex flex-1 items-center justify-center text-center font-body text-body text-grafito">
          {emptyMessage ?? "Sin datos en este periodo."}
        </p>
      ) : (
        <div className="flex-1 overflow-x-auto">{children}</div>
      )}
    </div>
  );
}
