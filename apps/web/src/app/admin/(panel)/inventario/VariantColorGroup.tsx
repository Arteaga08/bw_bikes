"use client";

import type { AdminInventoryVariantRow } from "@bw-bikes/shared";
import { ColorSwatch } from "@/components/ui/ColorSwatch";
import { VariantStockRow } from "./VariantStockRow";

export interface VariantColorGroupProps {
  /** `null` for accessories with no color axis at all — renders with no header, just its rows. */
  colorName: string | null;
  hex: string | null;
  secondaryHex?: string | null;
  variants: AdminInventoryVariantRow[];
  pendingSku: string | null;
  onIncrement: (variant: AdminInventoryVariantRow, amount: number) => void;
  onDecrement: (variant: AdminInventoryVariantRow, amount: number) => void;
  onAdjustSubmit: (
    variant: AdminInventoryVariantRow,
    input: { delta: number } | { onHand: number },
    reason: string | undefined,
  ) => void | Promise<void>;
}

/** One color's sizes — the grouping the old flat SKU list never offered. Reuses `ColorSwatch` as-is (storefront and admin "Colores" screen both already render it the same way). */
export function VariantColorGroup({
  colorName,
  hex,
  secondaryHex,
  variants,
  pendingSku,
  onIncrement,
  onDecrement,
  onAdjustSubmit,
}: VariantColorGroupProps) {
  const totalAvailable = variants.reduce((sum, variant) => sum + variant.available, 0);
  const sizeWord = variants.length === 1 ? "talla" : "tallas";

  return (
    <div className="rounded-card border border-borde">
      {colorName ? (
        <div className="flex items-center gap-sm border-b border-borde bg-inset px-md py-sm">
          <ColorSwatch hex={hex} secondaryHex={secondaryHex} className="h-4 w-4" />
          <span className="font-ui text-ui text-negro">{colorName}</span>
          <span className="font-body text-caption text-grafito">
            {variants.length} {sizeWord} · {totalAvailable} disponibles
          </span>
        </div>
      ) : null}

      {variants.map((variant) => (
        <VariantStockRow
          key={variant.sku}
          variant={variant}
          pending={pendingSku === variant.sku}
          onIncrement={(amount) => onIncrement(variant, amount)}
          onDecrement={(amount) => onDecrement(variant, amount)}
          onAdjustSubmit={(input, reason) => onAdjustSubmit(variant, input, reason)}
        />
      ))}
    </div>
  );
}
