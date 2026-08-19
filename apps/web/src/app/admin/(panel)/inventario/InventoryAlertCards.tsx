"use client";

import type { InventorySummaryTotals } from "@bw-bikes/shared";
import { StatCard } from "@/components/ui/StatCard";
import { StatCardSkeleton } from "@/components/ui/Skeleton";

export type InventoryStockFilter = "out" | "low";

export interface InventoryAlertCardsProps {
  totals: InventorySummaryTotals | null;
  activeFilter: InventoryStockFilter | null;
  onToggleFilter: (filter: InventoryStockFilter) => void;
}

/**
 * The store-wide "at a glance" row atop `/admin/inventario` — same `StatCard`
 * pattern `OrdersSummaryCards.tsx` uses on `/admin/ordenes`, reused as-is
 * (accent stripe included) for visual consistency across the panel rather
 * than inventing a second card style. Replaces what used to be a standalone
 * "Reposición" list: that list's rows all already exist inside "Por
 * categoría" too (badge and all), so the cards give the quick read without
 * duplicating the same SKUs twice on one page.
 *
 * "Agotados"/"Bajos" are clickable — unlike Órdenes' tiles they don't
 * navigate anywhere, they toggle a filter on "Por categoría" right below
 * (there is nowhere else on this single-page screen to go). "Nuevos" stays
 * a plain count: the backend has no `stock=new` filter to drive, and nobody
 * asked for one yet.
 */
export function InventoryAlertCards({ totals, activeFilter, onToggleFilter }: InventoryAlertCardsProps) {
  if (!totals) {
    return (
      <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
      <StatCard
        label="Agotados"
        value={totals.outOfStockSkus}
        hint={totals.outOfStockSkus > 0 ? "Sin unidades disponibles" : "Ninguno agotado"}
        tone={totals.outOfStockSkus > 0 ? "error" : "neutral"}
        active={activeFilter === "out"}
        onClick={() => onToggleFilter("out")}
      />
      <StatCard
        label="Bajos"
        value={totals.lowStockSkus}
        hint={totals.lowStockSkus > 0 ? "En o bajo su umbral" : "Ninguno bajo su umbral"}
        tone={totals.lowStockSkus > 0 ? "advertencia" : "neutral"}
        active={activeFilter === "low"}
        onClick={() => onToggleFilter("low")}
      />
      <StatCard label="Nuevos" value={totals.newSkus} hint="Últimos 7 días" tone="neutral" />
    </div>
  );
}
