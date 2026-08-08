import type { AdminOrder, Carrier, OrderStatus, PublicOrder, ShippingAddress } from "@bw-bikes/shared";
import type { BULK_ALLOWED_STATUSES } from "@/lib/orders/status";
import { apiFetch } from "./client";
import type { ParsedResponse } from "./parse-response";

export interface AdminOrderListParams {
  page?: number;
  limit?: number;
  /** Whitelisted by the backend to `createdAt` | `totalCents` | `status`, `-` prefix for descending. */
  sort?: string;
  status?: OrderStatus;
  /** Exact match, case-insensitive on the wire (the backend uppercases it) — never a free-text search. */
  orderNumber?: string;
}

/**
 * Builds the querystring from an explicit whitelist and drops empty values —
 * never forwards the caller's full filter-state object. Mirrors
 * `adminOrderListQuerySchema` (`apps/api/src/validators/order.validator.ts`):
 * `search` is deliberately not a param here because `listForAdmin` accepts
 * it but never reads it.
 */
function buildOrderListQuery(params: AdminOrderListParams): string {
  const entries: Array<[string, string]> = [];
  if (params.page !== undefined) entries.push(["page", String(params.page)]);
  if (params.limit !== undefined) entries.push(["limit", String(params.limit)]);
  if (params.sort) entries.push(["sort", params.sort]);
  if (params.status) entries.push(["status", params.status]);
  if (params.orderNumber) entries.push(["orderNumber", params.orderNumber]);

  const query = new URLSearchParams(entries).toString();
  return query ? `?${query}` : "";
}

export function listAdminOrders(params: AdminOrderListParams): Promise<ParsedResponse<{ orders: AdminOrder[] }>> {
  return apiFetch<{ orders: AdminOrder[] }>(`/admin/orders${buildOrderListQuery(params)}`);
}

export async function getAdminOrder(id: string): Promise<AdminOrder> {
  const { data } = await apiFetch<{ order: AdminOrder }>(`/admin/orders/${id}`);
  return data.order;
}

/**
 * Returns `PublicOrder`, not `AdminOrder` — this is what
 * `confirmSupplierStock` actually serializes (`order.service.ts`), missing
 * `customer`, `adminAlertedAt`, `cancelReason` and `paymentIntentId`. Typing
 * it honestly means the compiler blocks an optimistic update that reads a
 * field this response doesn't have; callers must refetch for the `AdminOrder`
 * shape.
 */
export async function confirmSupplierStock(id: string): Promise<PublicOrder> {
  const { data } = await apiFetch<{ order: PublicOrder }>(`/admin/orders/${id}/confirm-supplier-stock`, {
    method: "POST",
  });
  return data.order;
}

export async function rejectSupplierStock(id: string, reason: string): Promise<PublicOrder> {
  const { data } = await apiFetch<{ order: PublicOrder }>(`/admin/orders/${id}/reject-supplier-stock`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  return data.order;
}

export async function updateOrderShippingAddress(id: string, address: ShippingAddress): Promise<PublicOrder> {
  const { data } = await apiFetch<{ order: PublicOrder }>(`/admin/orders/${id}/shipping-address`, {
    method: "PATCH",
    body: JSON.stringify(address),
  });
  return data.order;
}

/**
 * The `PATCH /:id/shipment` request body — `recordShipmentSchema`
 * (`apps/api/src/validators/shipping.validator.ts`), not `ShipmentSummary`
 * (the response shape, which additionally carries `shippedAt` and is never
 * something the client sets). `carrierName`/`trackingUrl` are required only
 * when `carrier === "otro"`; the six known carriers get their tracking URL
 * built server-side.
 */
export interface RecordShipmentInput {
  carrier: Carrier;
  carrierName?: string;
  trackingNumber: string;
  trackingUrl?: string;
}

export async function recordOrderShipment(id: string, shipment: RecordShipmentInput): Promise<PublicOrder> {
  const { data } = await apiFetch<{ order: PublicOrder }>(`/admin/orders/${id}/shipment`, {
    method: "PATCH",
    body: JSON.stringify(shipment),
  });
  return data.order;
}

export interface BulkStatusResultItem {
  id: string;
  orderNumber: string;
  outcome: "updated" | "unchanged" | "rejected";
  message?: string;
}

export interface BulkStatusResult {
  results: BulkStatusResultItem[];
  summary: { updated: number; unchanged: number; rejected: number };
}

/**
 * The **only** way to move a single order between the statuses the backend
 * exposes to admins — there is no `PATCH /orders/:id/status`
 * (`apps/api/src/routes/admin-order.route.ts`). Callers moving one order
 * pass a one-element `orderIds` array; this always resolves 200 even when
 * every order in the batch was rejected, so read `summary` rather than
 * trusting the promise to reject.
 */
export async function bulkUpdateOrderStatus(
  orderIds: string[],
  status: (typeof BULK_ALLOWED_STATUSES)[number],
  reason?: string,
): Promise<BulkStatusResult> {
  const { data } = await apiFetch<BulkStatusResult>("/admin/orders/bulk-status", {
    method: "PATCH",
    body: JSON.stringify({ orderIds, status, ...(reason ? { reason } : {}) }),
  });
  return data;
}
