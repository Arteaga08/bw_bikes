"use client";

import type { PublicSizeGuideEntry } from "@bw-bikes/shared";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { SizeGuideModal, type SizeGuideTab } from "./SizeGuideModal";

export interface SizeOption {
  value: string;
  available: boolean;
}

export interface SizeSelectorProps {
  sizes: SizeOption[];
  selected: string | undefined;
  onSelect: (size: string) => void;
  /** Bikes only — empty on an accessory PDP, or on a bike whose sizes haven't been given a height range yet. Gates whether the "¿Cuál es mi talla?"/"Guía de tallas" links render at all: two links opening onto an empty modal would be worse than no links. */
  sizeGuide?: PublicSizeGuideEntry[];
  /** The customer's saved `fit.heightCm` (A4), passed through to `SizeGuideModal`. */
  initialHeightCm?: number;
}

/**
 * Flat rectangular buttons, not a dropdown and not `ButtonGroup` — that
 * component is scoped to adjacent controls acting on the same thing (reorder
 * arrows, stepper), not a multi-choice picker. An unavailable size — no active
 * variant for it under the current color, **or** an active variant that's
 * sold out (`B-carrito.md` §4: `ProductInfo` folds `useVariantAvailability`
 * into this same `available` flag) — stays visible, struck through and
 * disabled, rather than hidden: a shopper should see the size exists, not
 * wonder if it was never offered.
 *
 * `role="radiogroup"`/`role="radio"`, same native-semantics reasoning as
 * `ColorSwatchSelector`.
 *
 * "¿Cuál es mi talla?" / guía de tallas — both links open the same
 * `SizeGuideModal`, one per tab. `onSelect` (this component's own prop) is
 * reused as the modal's confirm action, so picking a size from the wizard's
 * result step lands on this exact radiogroup with no extra state to sync.
 */
export function SizeSelector({ sizes, selected, onSelect, sizeGuide = [], initialHeightCm }: SizeSelectorProps) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideTab, setGuideTab] = useState<SizeGuideTab>("finder");

  if (sizes.length === 0) return null;

  function openGuide(tab: SizeGuideTab): void {
    setGuideTab(tab);
    setGuideOpen(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="font-ui text-ui text-grafito">Talla</span>
        {sizeGuide.length > 0 ? (
          <div className="flex items-center gap-xs">
            <Button variant="text" tone="neutral" size="sm" onClick={() => openGuide("finder")}>
              ¿Cuál es mi talla?
            </Button>
            <span aria-hidden="true" className="text-grafito">
              ·
            </span>
            <Button variant="text" tone="neutral" size="sm" onClick={() => openGuide("guide")}>
              Guía de tallas
            </Button>
          </div>
        ) : null}
      </div>
      <div role="radiogroup" aria-label="Talla" className="mt-xs flex flex-wrap gap-sm">
        {sizes.map((size) => {
          const isSelected = size.value === selected;
          // A stale `selected` value (from before a color change dropped this
          // size) must never paint the solid "chosen" look on a now-disabled
          // button — the disabled/struck-through state always wins.
          const isSelectedAndAvailable = isSelected && size.available;
          return (
            <button
              key={size.value}
              type="button"
              role="radio"
              aria-checked={isSelectedAndAvailable}
              disabled={!size.available}
              onClick={() => onSelect(size.value)}
              className={cn(
                "flex h-11 min-w-11 items-center justify-center rounded-control border px-xs font-ui text-ui transition-colors duration-150",
                "disabled:cursor-not-allowed disabled:border-borde disabled:bg-transparent disabled:text-grafito/40 disabled:line-through disabled:hover:border-borde",
                isSelectedAndAvailable ? "border-negro bg-negro text-blanco" : "border-borde text-negro hover:border-negro",
              )}
            >
              {size.value}
            </button>
          );
        })}
      </div>

      <SizeGuideModal
        open={guideOpen}
        tab={guideTab}
        onTabChange={setGuideTab}
        sizeGuide={sizeGuide}
        sizeOptions={sizes}
        onClose={() => setGuideOpen(false)}
        onSelectSize={onSelect}
        initialHeightCm={initialHeightCm}
      />
    </div>
  );
}
