"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/Checkbox";

export interface CatalogFilterCheckboxOption {
  value: string;
  label: string;
}

export interface CatalogFilterCheckboxListProps {
  options: CatalogFilterCheckboxOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}

const VISIBLE_COUNT = 5;

/** One `Checkbox` per option, `VISIBLE_COUNT` shown at first with "Ver más" revealing the rest — the options array is expected pre-sorted by coverage (`product.service.ts`'s `getFilterOptions`), so the ones a shopper is most likely to want are already on top. */
export function CatalogFilterCheckboxList({ options, selected, onChange }: CatalogFilterCheckboxListProps) {
  const [showAll, setShowAll] = useState(false);

  if (options.length === 0) return null;

  const visible = showAll ? options : options.slice(0, VISIBLE_COUNT);
  const hiddenCount = options.length - VISIBLE_COUNT;

  function toggle(value: string): void {
    onChange(selected.includes(value) ? selected.filter((candidate) => candidate !== value) : [...selected, value]);
  }

  return (
    <div className="flex flex-col gap-sm">
      {visible.map((option) => (
        <Checkbox
          key={option.value}
          label={option.label}
          checked={selected.includes(option.value)}
          onChange={() => toggle(option.value)}
        />
      ))}
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
