"use client";

import { ColorSwatch } from "@/components/ui/ColorSwatch";
import { cn } from "@/lib/cn";

export interface ColorOption {
  value: string;
  hex: string | null;
  secondaryHex: string | null;
}

export interface ColorSwatchSelectorProps {
  colors: ColorOption[];
  selected: string | undefined;
  onSelect: (color: string) => void;
}

/**
 * Renders even for a single color — both reference PDPs (Cannondale,
 * Specialized) show the lone color as a swatch plus its name, not as an
 * omitted row. A single-radio `radiogroup` is still valid ARIA (it just
 * reports "1 of 1").
 *
 * Native radio semantics (`role="radiogroup"`/`role="radio"`) so arrow-key
 * navigation and the screen-reader "N of M" count come for free, same
 * reasoning as `CatalogSortMenu`'s fieldset. The selection ring sits a step
 * outside `ColorSwatch`'s own circle (`ring-offset`) instead of on it, so it
 * never fights that component's `border-borde`/`border-dashed` rings.
 */
export function ColorSwatchSelector({ colors, selected, onSelect }: ColorSwatchSelectorProps) {
  if (colors.length === 0) return null;

  return (
    <div>
      <span className="font-ui text-ui text-negro">
        Color
        {selected ? <span className="text-grafito">: {selected}</span> : null}
      </span>
      <div role="radiogroup" aria-label="Color" className="mt-xs flex flex-wrap items-center gap-md">
        {colors.map((color) => {
          const isSelected = color.value === selected;
          return (
            <button
              key={color.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={color.value}
              onClick={() => onSelect(color.value)}
              className={cn(
                "rounded-full p-[3px] ring-offset-2 transition-shadow duration-150",
                isSelected ? "ring-2 ring-negro" : "ring-1 ring-transparent hover:ring-borde",
              )}
            >
              <ColorSwatch hex={color.hex} secondaryHex={color.secondaryHex} className="h-10 w-10" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
