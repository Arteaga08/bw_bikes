"use client";

import { buildImageUrl } from "@bw-bikes/shared";
import Image from "next/image";
import { useCart } from "@/components/cart/CartProvider";
import { CouponForm } from "@/components/cart/CouponForm";
import { formatCurrencyCents } from "@/lib/format";

export interface CheckoutSummaryProps {
  /** Resolves each line's `imagePublicId` into a URL — read server-side (`cloudinaryCloudName()`) and threaded down, same as `CartLineItem`. */
  cloudName: string;
}

/**
 * The resumen of C1-checkout-datos.md §6 — same totals escalator as
 * `CartSummary`, plus the read-only line list and the coupon form (reused
 * as-is). No longer carries its own "Continuar al pago" CTA
 * (M-checkout-una-pagina): Contacto, Envío and Pago all live on this one
 * page now, each with its own inline call to action, so there's no separate
 * destination left to link to.
 */
export function CheckoutSummary({ cloudName }: CheckoutSummaryProps) {
  const { cart } = useCart();
  if (!cart) return null;

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-col gap-md rounded-card-lg bg-overlay p-xl text-blanco">
        <h2 className="font-display text-h2">Tu pedido</h2>

        <ul className="flex flex-col gap-md">
          {cart.lines.map((line) => (
            <li
              key={`${line.itemType}:${line.sku}`}
              className="flex items-center gap-sm border-b border-blanco/10 pb-md last:border-none last:pb-0"
            >
              <div className="relative size-14 shrink-0 overflow-hidden rounded-control bg-blanco">
                {line.imagePublicId ? (
                  <Image
                    src={buildImageUrl(cloudName, line.imagePublicId, { width: 112 })}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-contain"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-eyebrow uppercase text-blanco/60">{line.brand}</p>
                <p className="truncate font-ui text-ui font-extrabold">
                  {line.name} · {line.qty}
                </p>
              </div>
              <p className="shrink-0 font-ui text-ui font-extrabold">{formatCurrencyCents(line.lineTotalCents)}</p>
            </li>
          ))}
        </ul>

        <dl className="flex flex-col gap-xs font-body text-body">
          <div className="flex items-center justify-between">
            <dt className="text-blanco/60">Subtotal</dt>
            <dd>{formatCurrencyCents(cart.subtotalCents)}</dd>
          </div>
          {cart.discountCents > 0 ? (
            <div className="flex items-center justify-between">
              <dt className="text-blanco/60">Descuento</dt>
              <dd>−{formatCurrencyCents(cart.discountCents)}</dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <dt className="text-blanco/60">IVA</dt>
            <dd>{formatCurrencyCents(cart.taxCents)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-blanco/60">Envío</dt>
            <dd className={cart.shippingCents === 0 ? "font-extrabold text-dorado" : undefined}>
              {cart.shippingCents === 0 ? "Gratis" : formatCurrencyCents(cart.shippingCents)}
            </dd>
          </div>
          <div className="mt-xs flex items-center justify-between border-t border-blanco/10 pt-md">
            <dt className="font-ui text-ui">Total</dt>
            <dd className="font-display text-h3 font-extrabold text-dorado">{formatCurrencyCents(cart.totalCents)}</dd>
          </div>
        </dl>

        {cart.captureMethod !== "automatic" ? (
          <p className="rounded-control bg-estado-advertencia-soft px-md py-sm font-body text-caption text-estado-advertencia">
            Uno o más productos se confirman con el proveedor antes de cobrarse: el cargo se autoriza ahora y se
            confirma después, cuando el proveedor confirme el stock.
          </p>
        ) : null}
      </div>

      <CouponForm coupon={cart.coupon} />
    </div>
  );
}
