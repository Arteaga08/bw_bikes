"use client";

import { X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import type { FilterChip } from "@/lib/storefront-catalog-filters";

export interface CatalogFilterChipsProps {
  chips: FilterChip[];
  onRemove: (key: string) => void;
  onClearAll: () => void;
}

/** Active filters as removable chips, plus a "Limpiar filtros" escape hatch — the accent stays reserved for the primary CTA elsewhere on the page (DESIGN_SYSTEM.md's one-dorado rule), so a chip is solid `negro`, not gold. */
export function CatalogFilterChips({ chips, onRemove, onClearAll }: CatalogFilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-sm">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onRemove(chip.key)}
          aria-label={`Quitar filtro ${chip.label}`}
          className="flex items-center gap-xs rounded-control border border-negro bg-negro px-sm py-1 font-ui text-caption text-blanco transition-colors duration-150 hover:bg-negro-hover"
        >
          {chip.label}
          <X aria-hidden="true" size={12} weight="bold" />
        </button>
      ))}
      <Button variant="text" tone="neutral" size="sm" onClick={onClearAll}>
        Limpiar filtros
      </Button>
    </div>
  );
}
