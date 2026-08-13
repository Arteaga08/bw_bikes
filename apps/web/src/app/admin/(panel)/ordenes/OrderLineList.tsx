import type { OrderLineSnapshot } from "@bw-bikes/shared";
import { formatCurrencyCents } from "@/lib/format";

const FULFILLMENT_LABELS: Record<OrderLineSnapshot["fulfillmentMode"], string> = {
  in_stock: "en stock",
  on_request: "bajo pedido",
  preorder: "preventa",
};

/** Renders the order's frozen line snapshot — never a live catalog lookup (order.ts's own contract). */
export function OrderLineList({ lines }: { lines: OrderLineSnapshot[] }) {
  return (
    <ul className="flex flex-col gap-sm">
      {lines.map((line, index) => (
        <li key={`${line.itemType}-${line.itemId}-${index}`} className="rounded-card border border-borde p-md">
          <div className="flex items-start justify-between gap-sm">
            <div>
              <p className="font-ui text-ui text-negro">{line.name}</p>
              <p className="font-body text-caption text-grafito">
                {line.brand} · SKU {line.sku}
                {line.size ? ` · talla ${line.size}` : ""}
                {line.color ? ` · ${line.color}` : ""} · {FULFILLMENT_LABELS[line.fulfillmentMode]}
              </p>
            </div>
            <p className="whitespace-nowrap font-ui text-ui text-negro">{formatCurrencyCents(line.lineTotalCents)}</p>
          </div>
          <p className="mt-xs font-body text-caption text-grafito">
            {line.qty} × {formatCurrencyCents(line.unitPriceCents)}
          </p>
        </li>
      ))}
    </ul>
  );
}
