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
 */
export function ChartCard({ title, subtitle, children, empty, emptyMessage }: ChartCardProps) {
  return (
    <div className="flex flex-col gap-md rounded-card border border-borde bg-surface p-lg">
      <div className="flex flex-col gap-xs">
        <h3 className="font-display text-h3 text-negro">{title}</h3>
        {subtitle ? <p className="font-body text-caption text-grafito">{subtitle}</p> : null}
      </div>
      {empty ? (
        <p className="py-xl text-center font-body text-body text-grafito">
          {emptyMessage ?? "Sin datos en este periodo."}
        </p>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </div>
  );
}
