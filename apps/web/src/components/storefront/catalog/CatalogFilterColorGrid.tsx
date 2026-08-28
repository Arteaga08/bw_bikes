"use client";

import { useId, useState } from "react";
import { ColorSwatch } from "@/components/ui/ColorSwatch";
import { cn } from "@/lib/cn";

export interface CatalogFilterColorOption {
  value: string;
  hex: string | null;
  secondaryHex: string | null;
}

export interface CatalogFilterColorGridProps {
  options: CatalogFilterColorOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}

const VISIBLE_COUNT = 6;

interface ColorOptionProps {
  option: CatalogFilterColorOption;
  checked: boolean;
  onToggle: () => void;
}

/**
 * Same sr-only-input + `peer-*` technique `Checkbox` uses, but with a
 * `ColorSwatch` ring standing in for the checkmark square — a color option
 * reads better as "this circle is the control" than as a checkbox next to a
 * second, redundant swatch.
 */
function ColorOption({ option, checked, onToggle }: ColorOptionProps) {
  const inputId = useId();

  return (
    <label htmlFor={inputId} className="flex cursor-pointer flex-col items-center gap-xs">
      <span className="relative inline-flex">
        <input type="checkbox" id={inputId} className="peer sr-only" checked={checked} onChange={onToggle} />
        <ColorSwatch
          hex={option.hex}
          secondaryHex={option.secondaryHex}
          className={cn(
            "h-8 w-8 transition-shadow duration-150",
            "peer-checked:ring-2 peer-checked:ring-negro peer-checked:ring-offset-2 peer-checked:ring-offset-surface",
            "peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-negro",
          )}
        />
      </span>
      <span className="max-w-[4.5rem] truncate font-body text-caption text-grafito">{option.value}</span>
    </label>
  );
}

/** Grid version of `CatalogFilterCheckboxList` for colors — `VISIBLE_COUNT` shown first (a 3-column, 2-row block), "Ver más" reveals the rest. */
export function CatalogFilterColorGrid({ options, selected, onChange }: CatalogFilterColorGridProps) {
  const [showAll, setShowAll] = useState(false);

  if (options.length === 0) return null;

  const visible = showAll ? options : options.slice(0, VISIBLE_COUNT);
  const hiddenCount = options.length - VISIBLE_COUNT;

  function toggle(value: string): void {
    onChange(selected.includes(value) ? selected.filter((candidate) => candidate !== value) : [...selected, value]);
  }

  return (
    <div className="flex flex-col gap-sm">
      <div className="grid grid-cols-3 gap-sm">
        {visible.map((option) => (
          <ColorOption
            key={option.value}
            option={option}
            checked={selected.includes(option.value)}
            onToggle={() => toggle(option.value)}
          />
        ))}
      </div>
      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setShowAll((current) => !current)}
          className="self-start font-ui text-caption text-grafito underline underline-offset-2 transition-colors duration-150 hover:text-negro"
        >
          {showAll ? "Ver menos" : `Ver más (${hiddenCount})`}
        </button>
      ) : null}
    </div>
  );
}
