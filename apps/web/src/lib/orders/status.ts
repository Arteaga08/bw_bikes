import type { OrderStatus } from "@bw-bikes/shared";
import type { BadgeVariant } from "@/components/ui/Badge";

/**
 * Spanish labels for `OrderStatus` — mirrors `STATUS_LABELS` in
 * `apps/api/src/services/order-state.ts` verbatim (transition-rejection
 * messages, the audit trail, and this dashboard all need to describe the
 * same ten states the same way). Kept as a `Record`, not a function with a
 * `default` branch: adding an `OrderStatus` member without updating this map
 * fails `pnpm typecheck` instead of silently rendering `undefined`.
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "pendiente de pago",
  authorized: "autorizada",
  awaiting_supplier_confirmation: "esperando confirmación del proveedor",
  authorization_expired: "con autorización vencida",
  paid: "pagada",
  processing: "en preparación",
  shipped: "enviada",
  delivered: "entregada",
  cancelled: "cancelada",
  refunded: "reembolsada",
};

/** `Object.keys` on `ORDER_STATUS_LABELS`, typed — feeds the status `<select>` in `OrderFilters`. */
export const ALL_ORDER_STATUSES = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];

/**
 * Semantic grouping for the status `Badge` in every order table/detail:
 * money-safe-and-moving states read `exito`, anything mid-flight or waiting
 * on a clock reads `advertencia`, and anything that ended without a sale (or
 * had to be undone) reads `error`. Exhaustive by type for the same reason as
 * the labels above.
 */
export function orderStatusBadgeVariant(status: OrderStatus): BadgeVariant {
  const variants: Record<OrderStatus, BadgeVariant> = {
    pending_payment: "advertencia",
    authorized: "advertencia",
    awaiting_supplier_confirmation: "advertencia",
    authorization_expired: "error",
    paid: "exito",
    processing: "exito",
    shipped: "exito",
    delivered: "exito",
    cancelled: "error",
    refunded: "error",
  };
  return variants[status];
}

/**
 * Statuses reachable admin-side only through `PATCH /orders/bulk-status`
 * (`BULK_ALLOWED_STATUSES` in `order.service.ts`) — there is no single-order
 * status endpoint, so every "mark as X" button in this app, including the
 * one on a lone order in the detail panel, calls the bulk endpoint with a
 * one-element `orderIds` array. Re-declared here (not imported from the API)
 * because `apps/web` never imports `apps/api` source.
 */
export const BULK_ALLOWED_STATUSES = ["processing", "delivered"] as const;
