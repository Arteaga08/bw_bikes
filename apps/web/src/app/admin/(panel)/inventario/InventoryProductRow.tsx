"use client";

import type { AdminInventoryProductRow as AdminInventoryProductRowData } from "@bw-bikes/shared";
import { CaretRight, Image as ImageIcon, Warning, WarningOctagon } from "@phosphor-icons/react";
import Image from "next/image";
import { memo } from "react";
import { Badge } from "@/components/ui/Badge";

export interface InventoryProductRowProps {
  product: AdminInventoryProductRowData;
  onOpen: (product: AdminInventoryProductRowData) => void;
}

/**
 * The row the redesign is about: a 64px photo, a two-line name, and
 * `Marca · Categoría` — the identifying information the old 48px SKU row
 * (`InventoryRow`, now deleted) never gave the reader enough of. One row per
 * **product**: `totalAvailable` and `variantCount` already sum every
 * variant, so a 4-variant product no longer repeats itself four times. Only
 * the exception gets a badge — a healthy product carries none, same rule the
 * old row followed.
 */
function InventoryProductRowInner({ product, onOpen }: InventoryProductRowProps) {
  const variantWord = product.variantCount === 1 ? "variante" : "variantes";

  return (
    <button
      type="button"
      onClick={() => onOpen(product)}
      className="flex w-full items-center gap-md border-b border-borde p-md text-left transition-colors duration-150 last:border-b-0 hover:bg-inset focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:-outline-offset-2 focus-visible:outline-negro"
    >
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-control bg-inset">
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.name} fill sizes="64px" className="object-cover" />
        ) : (
          <ImageIcon size={24} weight="light" aria-hidden="true" className="text-grafito opacity-40" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-ui text-body-l text-negro">{product.name}</p>
        <p className="truncate font-body text-caption text-grafito">
          {product.brand} · {product.categoryName}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {product.status === "on_request" ? (
          <Badge variant="unavailable">Bajo pedido</Badge>
        ) : (
          <>
            <span className="font-display text-h3 text-negro tabular-nums">{product.totalAvailable}</span>
            <span className="font-body text-caption text-grafito">
              {product.variantCount} {variantWord}
            </span>
          </>
        )}
      </div>

      <div className="flex w-24 shrink-0 justify-end">
        {product.status === "out" ? (
          <Badge variant="error">
            <span className="inline-flex items-center gap-1">
              <WarningOctagon size={12} weight="bold" aria-hidden="true" />
              Agotado
            </span>
          </Badge>
        ) : product.status === "low" ? (
          <Badge variant="advertencia">
            <span className="inline-flex items-center gap-1">
              <Warning size={12} weight="bold" aria-hidden="true" />
              Bajo
            </span>
          </Badge>
        ) : null}
      </div>

      <CaretRight size={16} weight="bold" aria-hidden="true" className="shrink-0 text-grafito" />
    </button>
  );
}

/** `React.memo`-wrapped: the list can render up to a page's worth of rows, same reasoning `InventoryRow` documented before it. */
export const InventoryProductRow = memo(InventoryProductRowInner);
