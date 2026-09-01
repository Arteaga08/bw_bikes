import type { PublicCart } from "@bw-bikes/shared";
import { WarningCircle } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/Button";
import { formatCurrencyCents } from "@/lib/format";

export interface CartSummaryProps {
  cart: PublicCart;
}

/**
 * Subtotal → descuento → IVA → envío → total, más los dos avisos que dependen
 * del contenido del carrito. El CTA de pago queda `disabled`: el checkout es
 * fase 2 de M13 (`B-carrito.md`, fuera de alcance).
 */
export function CartSummary({ cart }: CartSummaryProps) {
  return (
    <div className="flex flex-col gap-md rounded-card-lg border border-borde bg-surface p-lg">
      <h2 className="font-display text-h4 text-negro">Resumen</h2>

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

      <Button variant="primary" size="md" disabled title="Disponible próximamente" className="w-full">
        Pagar
      </Button>
    </div>
  );
}
