"use client";

import { cn } from "@/lib/cn";

export interface SizeOption {
  value: string;
  available: boolean;
}

export interface SizeSelectorProps {
  sizes: SizeOption[];
  selected: string | undefined;
  onSelect: (size: string) => void;
}

/**
 * Flat rectangular buttons, not a dropdown and not `ButtonGroup` — that
 * component is scoped to adjacent controls acting on the same thing (reorder
 * arrows, stepper), not a multi-choice picker. An unavailable size (no active
 * variant for it under the current color) stays visible, struck through and
 * disabled, rather than hidden: a shopper should see the size exists, not
 * wonder if it was never offered.
 *
 * `role="radiogroup"`/`role="radio"`, same native-semantics reasoning as
 * `ColorSwatchSelector`.
 *
 * "¿Cuál es mi talla?" / guía de tallas is a deliberately later step — its
 * anchor is the label row below, nothing built behind it yet.
 */
export function SizeSelector({ sizes, selected, onSelect }: SizeSelectorProps) {
  if (sizes.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="font-ui text-ui text-grafito">Talla</span>
        {/* "¿Cuál es mi talla?" / guía de tallas slots in here — later step. */}
      </div>
      <div role="radiogroup" aria-label="Talla" className="mt-xs flex flex-wrap gap-sm">
        {sizes.map((size) => {
          const isSelected = size.value === selected;
          return (
            <button
              key={size.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={!size.available}
              onClick={() => onSelect(size.value)}
              className={cn(
                "flex h-11 min-w-11 items-center justify-center rounded-control border px-xs font-ui text-ui transition-colors duration-150",
                "disabled:cursor-not-allowed disabled:text-grafito/40 disabled:line-through disabled:hover:border-borde",
                isSelected ? "border-negro bg-negro text-blanco" : "border-borde text-negro hover:border-negro",
              )}
            >
              {size.value}
            </button>
          );
        })}
      </div>
    </div>
  );
}
