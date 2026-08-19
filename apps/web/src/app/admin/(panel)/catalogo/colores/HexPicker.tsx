"use client";

import { Check, Plus } from "@phosphor-icons/react";
import { useId, useRef } from "react";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { CURATED_COLOR_PALETTE } from "./curated-palette";

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export interface HexPickerProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  error?: string;
}

/**
 * Grid of preset swatches (click sets the hex directly, no typing needed) plus a
 * "Personalizado" swatch that opens the browser's native `<input type="color">` for
 * anything outside the curated palette — so an admin never has to know or look up a
 * hex code to pick one. A de-emphasized text `Input` stays underneath for the rare
 * case someone has an exact code from a brand guide to paste in.
 */
export function HexPicker({ label, value, onChange, error }: HexPickerProps) {
  const labelId = useId();
  const nativeInputRef = useRef<HTMLInputElement>(null);
  const isCustom = value !== "" && !CURATED_COLOR_PALETTE.some((color) => color.hex.toLowerCase() === value.toLowerCase());

  return (
    <div className="flex flex-col gap-xs">
      <span id={labelId} className="font-ui text-ui text-negro">
        {label}
      </span>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-sm">
        {CURATED_COLOR_PALETTE.map((color) => {
          const selected = value.toLowerCase() === color.hex.toLowerCase();
          return (
            <button
              key={color.hex}
              type="button"
              aria-label={color.name}
              aria-pressed={selected}
              onClick={() => onChange(color.hex)}
              className={cn(
                "relative h-9 w-9 shrink-0 rounded-full border transition-colors duration-150",
                "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro",
                selected ? "border-negro" : "border-borde hover:border-grafito",
              )}
              style={{ backgroundColor: color.hex }}
            >
              {selected ? (
                <span className="absolute -right-0.5 -bottom-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-negro bg-blanco">
                  <Check aria-hidden="true" size={10} weight="bold" className="text-negro" />
                </span>
              ) : null}
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Personalizado"
          aria-pressed={isCustom}
          onClick={() => nativeInputRef.current?.click()}
          className={cn(
            "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
            "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro",
            isCustom ? "border-negro" : "border-dashed border-grafito hover:border-negro",
          )}
          style={isCustom ? { backgroundColor: value } : undefined}
        >
          {isCustom ? (
            <span className="absolute -right-0.5 -bottom-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-negro bg-blanco">
              <Check aria-hidden="true" size={10} weight="bold" className="text-negro" />
            </span>
          ) : (
            <Plus aria-hidden="true" size={16} className="text-grafito" />
          )}
        </button>
        <input
          ref={nativeInputRef}
          type="color"
          value={HEX_PATTERN.test(value) ? value : "#808080"}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label}: color personalizado`}
          className="sr-only"
        />
      </div>
      <Input
        label={`${label} (código hex)`}
        labelHidden
        placeholder="#RRGGBB"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        error={error}
        wrapperClassName="max-w-[10rem]"
      />
    </div>
  );
}
