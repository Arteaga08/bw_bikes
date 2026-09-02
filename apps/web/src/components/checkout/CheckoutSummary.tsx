"use client";

import { useCart } from "@/components/cart/CartProvider";
import { CouponForm } from "@/components/cart/CouponForm";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { formatCurrencyCents } from "@/lib/format";

/**
 * The resumen of C1-checkout-datos.md §6 — same totals escalator as
 * `CartSummary`, plus the read-only line list, the coupon form (reused
 * as-is), and the real "Continuar al pago" CTA, gated on a shipping
 * address already being on the cart (`CheckoutGuard` already blocks
 * rendering entirely for an empty/anonymous/errored cart, so this only
 * has to worry about "no address yet").
 */
export function CheckoutSummary() {
  const { cart } = useCart();
  if (!cart) return null;

  const canContinue = Boolean(cart.shippingAddress) && !cart.hasBlockingLines;

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-col gap-md rounded-card-lg border border-borde bg-surface p-lg">
        <h2 className="font-display text-h4 text-negro">Resumen</h2>

        <ul className="flex flex-col gap-sm">
          {cart.lines.map((line) => (
            <li key={`${line.itemType}:${line.sku}`} className="flex items-center justify-between gap-sm">
              <div className="min-w-0">
                <p className="font-body text-eyebrow uppercase text-grafito">{line.brand}</p>
                <p className="truncate font-ui text-ui text-negro">
                  {line.name} · {line.qty}
                </p>
              </div>
              <p className="shrink-0 font-body text-body text-negro">{formatCurrencyCents(line.lineTotalCents)}</p>
            </li>
          ))}
        </ul>

        <dl className="flex flex-col gap-xs font-body text-body text-negro">
          <div className="flex items-center justify-between">
            <dt className="text-grafito">Subtotal</dt>
            <dd>{formatCurrencyCents(cart.subtotalCents)}</dd>
          </div>
          {cart.discountCents > 0 ? (
            <div className="flex items-center justify-between">
              <dt className="text-grafito">Descuento</dt>
              <dd>−{formatCurrencyCents(cart.discountCents)}</dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <dt className="text-grafito">IVA</dt>
            <dd>{formatCurrencyCents(cart.taxCents)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-grafito">Envío</dt>
            <dd>{cart.shippingCents === 0 ? "Gratis" : formatCurrencyCents(cart.shippingCents)}</dd>
          </div>
          <div className="mt-xs flex items-center justify-between border-t border-borde pt-xs font-ui text-ui text-negro">
            <dt>Total</dt>
            <dd>{formatCurrencyCents(cart.totalCents)}</dd>
          </div>
        </dl>

        {cart.captureMethod !== "automatic" ? (
          <p className="rounded-control bg-estado-advertencia-soft px-md py-sm font-body text-caption text-estado-advertencia">
            Uno o más productos se confirman con el proveedor antes de cobrarse: el cargo se autoriza ahora y se
            confirma después, cuando el proveedor confirme el stock.
          </p>
        ) : null}

        <ButtonLink
          href="/checkout/pago"
          variant="primary"
          size="md"
          className="w-full"
          aria-disabled={canContinue ? undefined : "true"}
          onClick={(event) => {
            if (!canContinue) event.preventDefault();
          }}
          title={canContinue ? undefined : "Captura tu dirección de envío para continuar."}
        >
          Continuar al pago
        </ButtonLink>
      </div>

      <CouponForm coupon={cart.coupon} />
    </div>
  );
}
