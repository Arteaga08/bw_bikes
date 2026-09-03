"use client";

import type { PublicCartLine } from "@bw-bikes/shared";
import { buildImageUrl } from "@bw-bikes/shared";
import { Trash } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { productHref } from "@/components/storefront/products/product-href";
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
  const href = productHref({ kind: line.itemType, slug: line.slug });

  return (
    <li
      className={`flex gap-md border-b border-borde pb-lg last:border-none last:pb-0 ${compact ? "" : "sm:gap-lg"}`}
    >
      <Link
        href={href}
        aria-hidden="true"
        tabIndex={-1}
        className={`relative block shrink-0 overflow-hidden rounded-control bg-blanco ${compact ? "size-16" : "size-24 sm:size-44"}`}
      >
        {line.imagePublicId ? (
          <Image
            src={buildImageUrl(cloudName, line.imagePublicId, { width: (compact ? imageSize : 176) * 2 })}
            alt=""
            fill
            sizes={compact ? `${imageSize}px` : `(min-width: 640px) 176px, ${imageSize}px`}
            className="object-contain"
          />
        ) : null}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-md">
          <div className="min-w-0">
            <p className="font-body text-eyebrow uppercase text-grafito">{line.brand}</p>
            <Link href={href} className="font-display text-h3 text-negro hover:text-dorado-hover">
              {line.name}
            </Link>
            {line.size || line.color ? (
              <p className="mt-xs font-body text-caption text-grafito">{[line.size, line.color].filter(Boolean).join(" · ")}</p>
            ) : null}
          </div>

          <div className="shrink-0 text-right">
            <p className="font-body text-body text-negro">{formatCurrencyCents(line.lineTotalCents)}</p>
            {line.qty > 1 ? (
              <p className="font-body text-caption text-grafito">{formatCurrencyCents(line.unitPriceCents)} c/u</p>
            ) : null}
          </div>
        </div>

        {status ? (
          <p className={`mt-xs font-body text-caption ${status.tone === "error" ? "text-estado-error" : "text-estado-advertencia"}`}>
            {status.message}
          </p>
        ) : null}

        <div className="mt-md flex items-center justify-between gap-sm">
          <QuantityStepper
            qty={line.qty}
            max={maxQtyFor(line)}
            disabled={pending}
            onChange={(qty) => void setQty(line.itemType, line.sku, qty)}
          />
          <Button
            type="button"
            variant="bare"
            size="icon-sm"
            tone="danger"
            disabled={pending}
            onClick={() => void removeLine(line.itemType, line.sku)}
            aria-label={`Eliminar ${line.name} del carrito`}
          >
            <Trash />
          </Button>
        </div>
      </div>
    </li>
  );
}
