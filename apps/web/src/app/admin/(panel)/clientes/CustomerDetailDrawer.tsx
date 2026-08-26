"use client";

import type { AdminCustomerDetail } from "@bw-bikes/shared";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { SlideOver } from "@/components/ui/SlideOver";
import { adminCustomersApi } from "@/lib/api/admin-customers";
import { formatCurrencyCents } from "@/lib/format";

const DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" });

function formatDate(iso: string | undefined): string {
  return iso ? DATE_FORMATTER.format(new Date(iso)) : "—";
}

export interface CustomerDetailDrawerProps {
  customerId: string;
  customerName: string;
  onClose: () => void;
}

/**
 * "Row → detail" for a customer, in the `SlideOver` DASHBOARD_GUIDELINES.md
 * specs for exactly this. Fetches on open rather than being handed the list
 * row: the list carries aggregates only, and the orders and redeemed coupons
 * shown here would be wasted bytes on every one of the rows nobody clicks.
 */
export function CustomerDetailDrawer({ customerId, customerName, onClose }: CustomerDetailDrawerProps) {
  const [customer, setCustomer] = useState<AdminCustomerDetail | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminCustomersApi
      .getById(customerId)
      .then((result) => {
        if (!cancelled) setCustomer(result);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  return (
    <SlideOver open onClose={onClose} title={customerName} subtitle={customer?.email}>
      {loadError ? (
        <p className="font-body text-ui text-grafito">No se pudo cargar el cliente.</p>
      ) : !customer ? (
        <p className="font-body text-ui text-grafito">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-lg">
          <dl className="grid grid-cols-2 gap-md">
            <div>
              <dt className="font-body text-caption text-grafito">Compras</dt>
              <dd className="font-ui text-ui text-negro">{customer.orderCount}</dd>
            </div>
            <div>
              <dt className="font-body text-caption text-grafito">Total gastado</dt>
              <dd className="font-ui text-ui text-negro">{formatCurrencyCents(customer.totalSpentCents)}</dd>
            </div>
            <div>
              <dt className="font-body text-caption text-grafito">Ticket promedio</dt>
              <dd className="font-ui text-ui text-negro">{formatCurrencyCents(customer.averageOrderCents)}</dd>
            </div>
            <div>
              <dt className="font-body text-caption text-grafito">Cliente desde</dt>
              <dd className="font-ui text-ui text-negro">{formatDate(customer.createdAt)}</dd>
            </div>
          </dl>

          <section className="flex flex-col gap-sm">
            <h3 className="font-ui text-ui text-negro">Últimas compras</h3>
            {customer.recentOrders.length === 0 ? (
              <p className="font-body text-caption text-grafito">Todavía no ha comprado.</p>
            ) : (
              <ul className="flex flex-col gap-xs">
                {customer.recentOrders.map((order) => (
                  <li
                    key={order.id}
                    className="flex items-center justify-between gap-sm rounded-card border border-borde p-sm"
                  >
                    <div className="flex flex-col">
                      <span className="font-ui text-caption text-negro">{order.orderNumber}</span>
                      <span className="font-body text-caption text-grafito">{formatDate(order.createdAt)}</span>
                    </div>
                    <span className="font-ui text-caption text-negro">{formatCurrencyCents(order.totalCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-sm">
            <h3 className="font-ui text-ui text-negro">Cupones canjeados</h3>
            {customer.redeemedCoupons.length === 0 ? (
              <p className="font-body text-caption text-grafito">No ha canjeado ningún cupón.</p>
            ) : (
              <ul className="flex flex-col gap-xs">
                {customer.redeemedCoupons.map((redemption) => (
                  <li
                    key={redemption.id}
                    className="flex items-center justify-between gap-sm rounded-card border border-borde p-sm"
                  >
                    <div className="flex items-center gap-sm">
                      <Badge variant="accent">{redemption.code}</Badge>
                      <span className="font-body text-caption text-grafito">{redemption.orderNumber}</span>
                    </div>
                    <span className="font-ui text-caption text-negro">
                      −{formatCurrencyCents(redemption.discountCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </SlideOver>
  );
}
