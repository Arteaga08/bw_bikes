"use client";

import type { AdminInventoryItem } from "@bw-bikes/shared";
import { Warning, WarningOctagon } from "@phosphor-icons/react";
import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export interface InventoryRowProps {
  item: AdminInventoryItem;
  onAdjust: (item: AdminInventoryItem) => void;
}

/**
 * The row design the `impeccable` `shape` brief settled on: Disponible is
 * the one big number (it's the number the store itself uses), En bodega/
 * Apartado ride below it as a subordinate caption that only mentions
 * "apartado" when there actually is one — three columns of equal-weight
 * numbers was the earlier draft's mistake, this reads as one decision plus
 * its explanation. A healthy row carries no badge at all; only the
 * exception is marked, always with an icon, never color alone.
 */
export function InventoryRow({ item, onAdjust }: InventoryRowProps) {
  const isOnRequest = item.variant?.fulfillmentMode === "on_request" || item.variant?.fulfillmentMode === "preorder";
  const isOut = !isOnRequest && item.available <= 0;
  const isLow = !isOnRequest && !isOut && item.available <= item.lowStockThresholdUnits;

  const variantLabel = [item.variant?.size, item.variant?.color].filter(Boolean).join(" / ") || undefined;

  return (
    <div className="flex items-center gap-md border-b border-borde p-md last:border-b-0">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-control bg-inset">
        {item.product?.imageUrl ? (
          <Image src={item.product.imageUrl} alt={item.product.name} fill sizes="48px" className="object-cover" />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-ui text-ui text-negro">{item.product?.name ?? "Producto eliminado"}</p>
        <p className="truncate font-body text-caption text-grafito">
          {variantLabel ? `${variantLabel} · ` : ""}
          {item.sku}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {isOnRequest ? (
          <Badge variant="unavailable">Bajo pedido</Badge>
        ) : (
          <>
            <span className="font-display text-h3 text-negro tabular-nums">{item.available}</span>
            <span className="font-body text-caption text-grafito">
              {item.onHand} en bodega{item.reserved > 0 ? ` · ${item.reserved} apartado` : ""}
            </span>
          </>
        )}
      </div>

      <div className="flex w-24 shrink-0 justify-end">
        {isOut ? (
          <Badge variant="error">
            <span className="inline-flex items-center gap-1">
              <WarningOctagon size={12} weight="bold" aria-hidden="true" />
              Agotado
            </span>
          </Badge>
        ) : isLow ? (
          <Badge variant="advertencia">
            <span className="inline-flex items-center gap-1">
              <Warning size={12} weight="bold" aria-hidden="true" />
              Bajo
            </span>
          </Badge>
        ) : null}
      </div>

      {isOnRequest ? null : (
        <Button variant="bare" size="sm" onClick={() => onAdjust(item)}>
          Ajustar
        </Button>
      )}
    </div>
  );
}
