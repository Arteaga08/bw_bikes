"use client";

import type { PublicCartLine } from "@bw-bikes/shared";
import { buildImageUrl } from "@bw-bikes/shared";
import { Trash } from "@phosphor-icons/react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { formatCurrencyCents } from "@/lib/format";
import { useCart } from "./CartProvider";
import { cartLineStatus } from "./cart-line-status";
import { maxQtyFor } from "./cart-limits";
import { QuantityStepper } from "./QuantityStepper";

export interface CartLineItemProps {
  line: PublicCartLine;
  /** Resolves `line.imagePublicId` into a URL — read server-side (`cloudinaryCloudName()`) and threaded down, since this component itself is a client component with no env access. */
  cloudName: string;
  /** Tighter spacing/smaller image for `CartDrawer`; full size on `/carrito`. */
  compact?: boolean;
}

export function CartLineItem({ line, cloudName, compact = false }: CartLineItemProps) {
  const { setQty, removeLine, isPending } = useCart();
  const status = cartLineStatus(line);
  const pending = isPending(line.itemType, line.sku);
  const imageSize = compact ? 64 : 96;

  return (
    <li className="flex gap-md">
      <div
        className="relative shrink-0 overflow-hidden rounded-control bg-blanco"
        style={{ width: imageSize, height: imageSize }}
      >
        {line.imagePublicId ? (
          <Image
            src={buildImageUrl(cloudName, line.imagePublicId, { width: imageSize * 2 })}
            alt={line.name}
            fill
            sizes={`${imageSize}px`}
            className="object-contain"
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-body text-eyebrow uppercase text-grafito">{line.brand}</p>
        <p className="font-ui text-ui text-negro">{line.name}</p>
        {line.size || line.color ? (
          <p className="mt-xs font-body text-caption text-grafito">{[line.size, line.color].filter(Boolean).join(" · ")}</p>
        ) : null}
        <p className="mt-xs font-body text-body text-negro">{formatCurrencyCents(line.unitPriceCents)}</p>

        {status ? (
          <p className={`mt-xs font-body text-caption ${status.tone === "error" ? "text-estado-error" : "text-estado-advertencia"}`}>
            {status.message}
          </p>
        ) : null}

        <div className="mt-sm flex items-center gap-sm">
          <QuantityStepper
            qty={line.qty}
            max={maxQtyFor(line)}
            disabled={pending}
            onChange={(qty) => void setQty(line.itemType, line.sku, qty)}
          />
          <Button
            type="button"
            variant="bare"
            size="icon"
            tone="danger"
            disabled={pending}
            onClick={() => void removeLine(line.itemType, line.sku)}
            aria-label={`Eliminar ${line.name} del carrito`}
          >
            <Trash />
          </Button>
        </div>
      </div>

      <p className="shrink-0 font-body text-body text-negro">{formatCurrencyCents(line.lineTotalCents)}</p>
    </li>
  );
}
