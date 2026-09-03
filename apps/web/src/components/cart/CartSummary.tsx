import type { PublicCart } from "@bw-bikes/shared";
import { WarningCircle } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { formatCurrencyCents } from "@/lib/format";

export interface CartSummaryProps {
  cart: PublicCart;
}

/**
 * Subtotal → descuento → IVA → envío → total, más los dos avisos que dependen
 * del contenido del carrito. El CTA lleva a `/checkout/envio`
 * (C1-checkout-datos.md); solo queda deshabilitado cuando `hasBlockingLines`
 * — no hay nada que pagar todavía.
 */
export function CartSummary({ cart }: CartSummaryProps) {
  return (
    <div className="flex flex-col gap-md rounded-card-lg bg-overlay p-xl text-blanco">
      <h2 className="font-display text-h2">Resumen</h2>

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
          Uno o más productos se confirman con el proveedor antes de cobrarse. El cargo se autoriza ahora y se
          confirma después.
        </p>
      ) : null}

      {cart.hasBlockingLines ? (
        <p className="flex items-center gap-xs rounded-control bg-estado-error-soft px-md py-sm font-body text-caption text-estado-error">
          <WarningCircle size={16} weight="regular" aria-hidden="true" className="shrink-0" />
          Ajusta los productos marcados para poder continuar.
        </p>
      ) : null}

      {cart.hasBlockingLines ? (
        <Button variant="primary" size="md" disabled title="Ajusta los productos marcados para poder continuar." className="w-full">
          Pagar
        </Button>
      ) : (
        <ButtonLink href="/checkout/envio" variant="primary" size="md" className="w-full">
          Ir a pagar
        </ButtonLink>
      )}
    </div>
  );
}
