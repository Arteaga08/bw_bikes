"use client";

import type { AdminOrder } from "@bw-bikes/shared";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { listAdminOrders } from "@/lib/api/admin-orders";
import { formatCurrencyCents } from "@/lib/format";
import { formatDateShort } from "@/lib/orders/format";
import { OrderStatusBadge } from "./ordenes/OrderStatusBadge";

const RECENT_ORDERS_LIMIT = 5;

/**
 * The latest orders, period — deliberately not windowed by `HomeStats`'s
 * own date-range picker, the same reasoning `OperationsStrip`'s alerts use:
 * "recent" means the most recent orders that exist, not the most recent
 * orders inside whatever filter happens to be selected. Fetches once on
 * mount instead of re-running on every range change.
 *
 * Reuses `GET /admin/orders` (default sort `-createdAt`) rather than adding
 * a dedicated endpoint — five rows of an already-paginated list is exactly
 * what that route is for.
 */
export function RecentOrdersList() {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listAdminOrders({ limit: RECENT_ORDERS_LIMIT })
      .then((res) => {
        if (!cancelled) setOrders(res.data.orders);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-full flex-col gap-md rounded-card border border-borde bg-surface p-lg">
      <div className="flex items-center justify-between gap-md">
        <h3 className="font-display text-h3 text-negro">Órdenes recientes</h3>
        <ButtonLink href="/admin/ordenes" variant="text" size="sm">
          Ver todas
        </ButtonLink>
      </div>

      {loadError ? (
        <p className="font-body text-caption text-estado-error">No se pudo cargar la lista.</p>
      ) : orders === null ? (
        <div className="flex flex-1 flex-col justify-center gap-sm">
          {Array.from({ length: RECENT_ORDERS_LIMIT }, (_, index) => (
            <div key={index} className="flex items-center gap-md py-sm">
              <div className="h-4 flex-1 animate-pulse rounded-control bg-inset" />
              <div className="h-4 w-16 animate-pulse rounded-control bg-inset" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <p className="flex flex-1 items-center justify-center text-center font-body text-body text-grafito">
          Sin órdenes todavía.
        </p>
      ) : (
        // Fixed-width price/badge columns so every row aligns to the same
        // grid regardless of how wide a given status label happens to be
        // ("PENDIENTE DE PAGO" vs "PAGADA") — the misaligned columns were
        // exactly what read as "mal los espacios".
        <div className="flex flex-1 flex-col justify-center">
          {orders.map((order) => {
            const firstLineName = order.lines[0]?.name;
            const extraLines = order.lines.length - 1;
            return (
              <div
                key={order.id}
                className="flex items-center gap-md border-b border-borde py-md last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-ui text-ui text-negro">{firstLineName ?? order.orderNumber}</p>
                  <p className="truncate font-body text-caption text-grafito">
                    {order.orderNumber}
                    {extraLines > 0 ? ` +${extraLines} más` : ""} · {formatDateShort(order.createdAt)}
                  </p>
                </div>
                <span className="w-24 shrink-0 whitespace-nowrap text-right font-ui text-ui text-negro">
                  {formatCurrencyCents(order.totals.totalCents)}
                </span>
                <div className="w-36 shrink-0">
                  <OrderStatusBadge status={order.status} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
