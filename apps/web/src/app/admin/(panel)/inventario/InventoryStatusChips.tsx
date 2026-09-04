"use client";

import type { AdminInventoryProductCounts } from "@bw-bikes/shared";
import { Warning, WarningOctagon } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export type InventoryStockFilter = "out" | "low";

export interface InventoryStatusChipsProps {
  counts: AdminInventoryProductCounts | null;
  activeFilter: InventoryStockFilter | null;
  onToggleFilter: (filter: InventoryStockFilter) => void;
}

interface ChipDef {
  filter: InventoryStockFilter | null;
  label: string;
  count: number;
  tone: "error" | "advertencia" | "neutral";
}

const TONE_CLASSES: Record<ChipDef["tone"], { resting: string; active: string }> = {
  neutral: { resting: "border-borde text-grafito hover:border-negro hover:text-negro", active: "border-negro bg-negro text-blanco" },
  error: { resting: "border-borde text-estado-error hover:border-estado-error", active: "border-estado-error bg-estado-error text-blanco" },
  advertencia: {
    resting: "border-borde text-estado-advertencia hover:border-estado-advertencia",
    active: "border-estado-advertencia bg-estado-advertencia text-blanco",
  },
};

/**
 * Replaces the old three `StatCard`s (~180px tall) with a single-line
 * `radiogroup` (~34px) — the KPI count and the stock filter were always the
 * same control wearing two costumes, so this collapses them into one. Only
 * "Agotados"/"Bajos" are real states of a product; "Todos" clears the filter
 * rather than describing a status, and is always the resting tone since a
 * full catalog is never itself a problem.
 *
 * Counts come from the same `$facet` as the rows (`listAdminInventoryProducts`)
 * — computed over every status, unaffected by which chip is active — so
 * "Agotados 5" stays legible while "Bajos" is the one currently selected.
 */
export function InventoryStatusChips({ counts, activeFilter, onToggleFilter }: InventoryStatusChipsProps) {
  const chips: ChipDef[] = [
    { filter: null, label: "Todos", count: counts?.all ?? 0, tone: "neutral" },
    { filter: "out", label: "Agotados", count: counts?.out ?? 0, tone: "error" },
    { filter: "low", label: "Bajos", count: counts?.low ?? 0, tone: "advertencia" },
  ];

  return (
    <div role="radiogroup" aria-label="Filtrar por estado de stock" className="flex flex-wrap gap-sm">
      {chips.map((chip) => {
        const selected = chip.filter === activeFilter;
        const tone = TONE_CLASSES[chip.tone];
        return (
          <button
            key={chip.label}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={counts === null}
            onClick={() => {
              if (chip.filter) onToggleFilter(chip.filter);
              else if (activeFilter) onToggleFilter(activeFilter); // "Todos" clears whichever filter is active
            }}
            className={cn(
              "inline-flex items-center gap-xs rounded-control border px-sm py-1 font-ui text-caption transition-colors duration-150",
              "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro",
              "disabled:cursor-not-allowed disabled:opacity-50",
              selected ? tone.active : tone.resting,
            )}
          >
            {chip.tone === "error" ? <WarningOctagon size={12} weight="bold" aria-hidden="true" /> : null}
            {chip.tone === "advertencia" ? <Warning size={12} weight="bold" aria-hidden="true" /> : null}
            {chip.label} {chip.count}
          </button>
        );
      })}
    </div>
  );
}
