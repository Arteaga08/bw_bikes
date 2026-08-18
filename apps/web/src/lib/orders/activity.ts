import type { AdminOrderStatusHistoryEntry, AuditAction, OrderActivityEntry } from "@bw-bikes/shared";
import { ORDER_STATUS_LABELS } from "./status";

/**
 * Spanish labels for the order-module slice of `AuditAction` — the only
 * slice `GET /admin/orders/:id/activity` can ever return, since
 * `orderService.getActivity` (apps/api) filters the audit trail by
 * `module: "orders"` server-side. A `Partial`, not the exhaustive `Record`
 * `ORDER_STATUS_LABELS` uses: `AuditAction` spans every admin module
 * (catalog, inventory, settings…), and this file only owns the order slice.
 */
const ORDER_AUDIT_ACTION_LABELS: Partial<Record<AuditAction, string>> = {
  "order.created": "Orden creada",
  "order.authorized": "Pago autorizado",
  "order.paid": "Pago capturado",
  "order.supplier_confirmed": "Proveedor confirmó stock",
  "order.supplier_rejected": "Proveedor rechazó stock",
  "order.cancelled": "Orden cancelada",
  "order.authorization_expiring": "Aviso de autorización por vencer",
  "order.authorization_expired": "Autorización vencida",
  "order.refunded": "Orden reembolsada",
  "order.disputed": "Contracargo abierto",
  "order.reconciled": "Pago reconciliado",
  "order.shipping_address_updated": "Dirección de envío actualizada",
  "order.shipped": "Orden enviada",
  "order.shipment_updated": "Guía corregida",
  "order.bulk_status_updated": "Estatus actualizado",
  "order.priority_updated": "Prioridad actualizada",
  "order.note_added": "Nota interna agregada",
};

/**
 * Falls back to the raw action id for anything outside the map above —
 * defensive only, never expected in practice given the server-side module
 * filter, but better than rendering `undefined` if that filter ever changes.
 */
export function orderActivityLabel(action: AuditAction): string {
  return ORDER_AUDIT_ACTION_LABELS[action] ?? action;
}

export interface OrderTimelineEntry {
  key: string;
  at: string;
  label: string;
  actorType: "user" | "system";
  actorId?: string;
}

/**
 * Fuses `statusHistory` (every status move, always present) with the audit
 * trail (every recorded admin action, including ones with no status change —
 * a priority edit, a note) into one chronological list for the detail's
 * "Bitácora". Sorted newest first.
 *
 * The two sources are **not** a strict superset of one another:
 * `markPaymentFailed` and the webhook's own cancellation path move `status`
 * without a matching `recordAuditLog` call (`apps/api/src/services/order.service.ts`)
 * — an existing gap, not something to paper over here. Dropping either
 * source would silently hide real events, so both are kept and merged
 * instead of picking one.
 */
export function buildOrderTimeline(
  statusHistory: AdminOrderStatusHistoryEntry[],
  activity: OrderActivityEntry[],
): OrderTimelineEntry[] {
  const fromHistory: OrderTimelineEntry[] = statusHistory.map((entry, index) => ({
    key: `status-${index}-${entry.at}`,
    at: entry.at,
    label: `Estatus: ${ORDER_STATUS_LABELS[entry.status]}`,
    actorType: entry.actorType,
    ...(entry.actorId !== undefined ? { actorId: entry.actorId } : {}),
  }));

  const fromActivity: OrderTimelineEntry[] = activity.map((entry, index) => ({
    key: `activity-${index}-${entry.createdAt}`,
    at: entry.createdAt,
    label: orderActivityLabel(entry.action),
    actorType: entry.actorType,
    ...(entry.actorId !== undefined ? { actorId: entry.actorId } : {}),
  }));

  return [...fromHistory, ...fromActivity].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
