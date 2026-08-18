import type { AdminOrder } from "@bw-bikes/shared";
import { Package } from "@phosphor-icons/react";
import { formatCurrencyCents } from "@/lib/format";
import { formatDateShort, formatTimeShort } from "@/lib/orders/format";
import { AuthorizationCountdown } from "./AuthorizationCountdown";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { PaymentStateBadge } from "./PaymentStateBadge";

/**
 * Every cell here stacks a primary value over one or two secondary lines —
 * the reference's density (order + piece count, date + time, name + contact,
 * total + its breakdown) instead of one bare value per column. Extracted out
 * of `OrdersView.tsx` (already 600+ lines) so each cell's shape is readable
 * on its own; `OrdersView` only wires these into its two `DataTableColumn`
 * sets.
 */

export interface OrderNumberCellProps {
  order: AdminOrder;
  /** Only the queue tab has a clock worth showing — see `OrdersView`'s own `orderCell` comment. */
  showCountdown: boolean;
  alertHours: number;
  cancelHours: number;
}

export function OrderNumberCell({ order, showCountdown, alertHours, cancelHours }: OrderNumberCellProps) {
  const pieces = order.lines.reduce((sum, line) => sum + line.qty, 0);
  return (
    <div>
      <p className="font-ui text-ui text-negro">{order.orderNumber}</p>
      <p className="mt-xs flex items-center gap-xs font-body text-caption text-grafito">
        <Package size={12} aria-hidden="true" />
        {pieces} {pieces === 1 ? "pieza" : "piezas"}
      </p>
      {showCountdown ? (
        <div className="mt-xs">
          <AuthorizationCountdown
            authorizedAt={order.payment.authorizedAt}
            alertHours={alertHours}
            cancelHours={cancelHours}
            adminAlertedAt={order.adminAlertedAt}
          />
        </div>
      ) : null}
    </div>
  );
}

export function OrderDateCell({ iso }: { iso: string }) {
  return (
    <div>
      <p className="font-body text-body text-negro">{formatDateShort(iso)}</p>
      <p className="font-body text-caption text-grafito">{formatTimeShort(iso)}</p>
    </div>
  );
}

export function OrderCustomerCell({ order }: { order: AdminOrder }) {
  if (!order.customer) return <span className="font-body text-body text-grafito">—</span>;
  return (
    <div className="min-w-0">
      <p className="truncate font-body text-body text-negro">
        {order.customer.firstName} {order.customer.lastName}
      </p>
      <p className="truncate font-body text-caption text-grafito">{order.customer.email}</p>
      {order.shippingAddress ? (
        <p className="truncate font-body text-caption text-grafito">{order.shippingAddress.phone}</p>
      ) : null}
    </div>
  );
}

export function OrderTotalsCell({ order }: { order: AdminOrder }) {
  return (
    <div>
      <p className="font-body text-caption text-grafito">SUB: {formatCurrencyCents(order.totals.subtotalCents)}</p>
      <p className="font-body text-caption text-grafito">ENV: {formatCurrencyCents(order.totals.shippingCents)}</p>
      <p className="font-ui text-ui text-negro">{formatCurrencyCents(order.totals.totalCents)}</p>
    </div>
  );
}

/** Folds "Estatus" and "Pago" into one cell — an order's payment state reads as context under its status, not as a fully separate column. */
export function OrderStateCell({ order }: { order: AdminOrder }) {
  return (
    <div className="flex flex-col items-start gap-xs">
      <OrderStatusBadge status={order.status} />
      <PaymentStateBadge state={order.payment.state} />
    </div>
  );
}

export function OrderTrackingCell({ order }: { order: AdminOrder }) {
  if (!order.shipment) return <span className="font-body text-body text-grafito">—</span>;
  const { shipment } = order;
  return (
    <div className="min-w-0">
      <p className="truncate font-body text-body text-negro">{shipment.carrierName ?? shipment.carrier.toUpperCase()}</p>
      <a
        href={shipment.trackingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="truncate font-body text-caption text-grafito underline decoration-borde underline-offset-2 hover:text-negro"
      >
        {shipment.trackingNumber}
      </a>
    </div>
  );
}
