import type { OrderTotals } from "@bw-bikes/shared";
import { formatCurrencyCents } from "@/lib/format";

export interface OrderSummaryTableProps {
  totals: OrderTotals;
}

/** Subtotal → descuento (only when present) → IVA → envío → total, mirroring `OrderTotals`'s own identity. */
export function OrderSummaryTable({ totals }: OrderSummaryTableProps) {
  return (
    <dl className="flex flex-col gap-xs font-body text-body text-negro">
      <div className="flex justify-between gap-sm">
        <dt className="text-grafito">Subtotal</dt>
        <dd>{formatCurrencyCents(totals.subtotalCents)}</dd>
      </div>
      {totals.discountCents > 0 ? (
        <div className="flex justify-between gap-sm">
          <dt className="text-grafito">Descuento</dt>
          <dd>-{formatCurrencyCents(totals.discountCents)}</dd>
        </div>
      ) : null}
      <div className="flex justify-between gap-sm">
        <dt className="text-grafito">IVA incluido</dt>
        <dd>{formatCurrencyCents(totals.taxCents)}</dd>
      </div>
      <div className="flex justify-between gap-sm">
        <dt className="text-grafito">Envío</dt>
        <dd>{totals.shippingCents > 0 ? formatCurrencyCents(totals.shippingCents) : "Gratis"}</dd>
      </div>
      <div className="mt-xs flex justify-between gap-sm border-t border-borde pt-xs font-ui text-ui text-negro">
        <dt>Total</dt>
        <dd>{formatCurrencyCents(totals.totalCents)}</dd>
      </div>
    </dl>
  );
}
