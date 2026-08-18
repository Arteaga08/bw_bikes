"use client";

import type { AdminInventoryItem, InventorySummaryGroup } from "@bw-bikes/shared";
import { CaretDown } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { listAdminInventory } from "@/lib/api/admin-inventory";
import { InventoryRow } from "./InventoryRow";

export interface CategoryBandProps {
  group: InventorySummaryGroup;
  onAdjust: (item: AdminInventoryItem) => void;
  /** Bumped after any stock adjustment so an open band re-fetches its own rows without the parent tracking which band needs it. */
  refetchToken: number;
}

/**
 * The asymmetry IS the hierarchy: a healthy category's header stays grafito
 * and starts collapsed, one with a problem paints its count in the matching
 * status color and starts open — same component, different weight, decided
 * by the data. No card-in-a-card: this is a plain band inside the page's own
 * `bg-surface`, `bg-inset` only as the disclosure body separates from the
 * header hairline.
 */
export function CategoryBand({ group, onAdjust, refetchToken }: CategoryBandProps) {
  const hasIssue = group.outOfStockSkus + group.lowStockSkus > 0;
  const [open, setOpen] = useState(hasIssue);
  const [rows, setRows] = useState<AdminInventoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // "Adjust state during render", same pattern every list in this panel
  // uses: a `refetchToken` bump invalidates this band's cached rows right
  // here, in the render body — not inside the effect below, which only ever
  // responds to the fetch actually settling.
  const [lastRefetchToken, setLastRefetchToken] = useState(refetchToken);
  if (refetchToken !== lastRefetchToken) {
    setLastRefetchToken(refetchToken);
    setLoaded(false);
  }

  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    listAdminInventory({ itemType: group.itemType, category: group.categoryId, limit: 100, sort: "available" }).then(
      (result) => {
        if (cancelled) return;
        setRows(result.data.items);
        setLoaded(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, loaded, group.itemType, group.categoryId]);

  const loading = open && !loaded;

  return (
    <div className="border-b border-borde last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center gap-sm px-md py-sm text-left transition-colors duration-150 hover:bg-inset focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro"
      >
        <CaretDown size={14} weight="bold" aria-hidden="true" className={cn("shrink-0 transition-transform duration-150", open && "rotate-180")} />
        <span
          className={cn(
            "font-ui text-eyebrow uppercase",
            hasIssue ? (group.outOfStockSkus > 0 ? "text-estado-error" : "text-estado-advertencia") : "text-grafito",
          )}
        >
          {group.categoryName}
        </span>
        <span className="font-body text-caption text-grafito">{group.totalSkus} SKUs</span>
        {hasIssue ? (
          <span
            className={cn(
              "font-ui text-caption",
              group.outOfStockSkus > 0 ? "text-estado-error" : "text-estado-advertencia",
            )}
          >
            {group.outOfStockSkus > 0 ? `${group.outOfStockSkus} agotados` : `${group.lowStockSkus} bajos`}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="bg-inset">
          {loading ? (
            <p className="p-md font-body text-caption text-grafito">Cargando…</p>
          ) : rows.length === 0 ? (
            <p className="p-md font-body text-caption text-grafito">Sin SKUs en esta categoría.</p>
          ) : (
            rows.map((item) => <InventoryRow key={item.id} item={item} onAdjust={onAdjust} />)
          )}
        </div>
      ) : null}
    </div>
  );
}
