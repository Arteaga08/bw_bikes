import type { DisputeStatus, OrderPriority, OrderStatus, PaymentState } from "@bw-bikes/shared";
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
 * The four buckets an operator actually thinks in — same grouping
 * `OrdersSummaryCards`'s tiles count by, now the single source of truth both
 * the tiles and `OrderFilters`'s grouped status options read, so a tile's
 * count and the list it navigates to can never drift apart again (the bug
 * this existed to fix: "Pagos" used to count `paid + processing` but filter
 * to `status=paid` alone). Values are comma-joined for the `?status=` query
 * param `adminOrderListQuerySchema` now accepts as a list.
 *
 * Exhaustive by type for the same reason as the labels above — every
 * `OrderStatus` belongs to exactly one bucket, `satisfies` fails the build if
 * a new status is added without deciding where it goes.
 */
export const ORDER_STATUS_GROUPS = {
  action: ["pending_payment", "authorized", "awaiting_supplier_confirmation"],
  progress: ["paid", "processing"],
  shipping: ["shipped", "delivered"],
  problems: ["cancelled", "authorization_expired", "refunded"],
} as const satisfies Record<string, readonly OrderStatus[]>;

export type OrderStatusGroup = keyof typeof ORDER_STATUS_GROUPS;

export const ORDER_STATUS_GROUP_LABELS: Record<OrderStatusGroup, string> = {
  action: "Requieren acción",
  progress: "Pagadas / en preparación",
  shipping: "Enviadas / entregadas",
  problems: "Canceladas / con problema",
};

/**
 * The `?status=` filter's csv value → the group it exactly matches, if any —
 * order-insensitive, so `OrdersSummaryCards` (which builds the value from
 * `ORDER_STATUS_GROUPS` directly) and a value restored from elsewhere agree.
 * Returns `null` for `""`, a single individual status, or any set that isn't
 * exactly one whole group — the caller reads that as "no tile is the active
 * one right now", not an error.
 */
export function matchStatusGroup(value: string): OrderStatusGroup | null {
  const parts = new Set(value.split(",").filter(Boolean));
  if (parts.size === 0) return null;
  for (const group of Object.keys(ORDER_STATUS_GROUPS) as OrderStatusGroup[]) {
    const statuses = ORDER_STATUS_GROUPS[group];
    if (parts.size === statuses.length && statuses.every((status) => parts.has(status))) return group;
  }
  return null;
}

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
 * Spanish labels for `PaymentState` — the "Pago" column/badge in the "Todas"
 * tab (M11.5), distinct from `OrderStatus`: an order can be `processing`
 * while its payment is `captured`, and the table shows both independently
 * rather than inferring one from the other.
 */
export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  pending: "pendiente",
  authorized: "autorizado",
  captured: "cobrado",
  failed: "fallido",
  canceled: "cancelado",
  refunded: "reembolsado",
};

export function paymentStateBadgeVariant(state: PaymentState): BadgeVariant {
  const variants: Record<PaymentState, BadgeVariant> = {
    pending: "neutral",
    authorized: "advertencia",
    captured: "exito",
    failed: "error",
    canceled: "neutral",
    refunded: "error",
  };
  return variants[state];
}

/**
 * Spanish labels for `DisputeStatus` — the outcome row in the "Pago" section
 * of `OrderDetailPanel`, only rendered when `order.disputeStatus` is set.
 */
export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  open: "en curso",
  won: "ganado",
  lost: "perdido",
  withdrawn: "retirado",
};

export function disputeStatusBadgeVariant(status: DisputeStatus): BadgeVariant {
  const variants: Record<DisputeStatus, BadgeVariant> = {
    open: "advertencia",
    won: "exito",
    lost: "error",
    withdrawn: "neutral",
  };
  return variants[status];
}

/** Spanish labels for `OrderPriority` — the triage `Select` in the detail and the "Todas" column. */
export const ORDER_PRIORITY_LABELS: Record<OrderPriority, string> = {
  normal: "normal",
  alta: "alta",
  urgente: "urgente",
};

/** `Object.keys` on `ORDER_PRIORITY_LABELS`, typed — feeds the priority `<select>`s. */
export const ALL_ORDER_PRIORITIES = Object.keys(ORDER_PRIORITY_LABELS) as OrderPriority[];

export function orderPriorityBadgeVariant(priority: OrderPriority): BadgeVariant {
  const variants: Record<OrderPriority, BadgeVariant> = {
    normal: "neutral",
    alta: "advertencia",
    urgente: "error",
  };
  return variants[priority];
}

/**
 * Where an order stands relative to shipment capture — drives whether the
 * "Logística de envío" card in the detail modal shows the real
 * `ShipmentForm`/summary, a "not yet" placeholder, or a "never" placeholder,
 * instead of disappearing outright on any status the form doesn't handle.
 * Exhaustive by type for the same reason as the labels above: adding an
 * `OrderStatus` without updating this map fails `pnpm typecheck`.
 */
export type ShipmentEligibility = "eligible" | "not_yet" | "never";

/** Mirrors `recordShipment`'s own status guard in `order.service.ts` — `processing`, `shipped`, `delivered` accept a shipment; anything before is too early, anything after `cancelled`/`refunded` never ships. */
export function shipmentEligibility(status: OrderStatus): ShipmentEligibility {
  const eligibility: Record<OrderStatus, ShipmentEligibility> = {
    pending_payment: "not_yet",
    authorized: "not_yet",
    awaiting_supplier_confirmation: "not_yet",
    authorization_expired: "not_yet",
    paid: "not_yet",
    processing: "eligible",
    shipped: "eligible",
    delivered: "eligible",
    cancelled: "never",
    refunded: "never",
  };
  return eligibility[status];
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
