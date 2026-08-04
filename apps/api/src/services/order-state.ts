import type { OrderStatus } from "@bw-bikes/shared";
import { AppError } from "../utils/index.js";

/**
 * The order lifecycle, as data.
 *
 * Every status change in this module goes through `assertTransition`. Nothing
 * anywhere else may write `order.status` directly: a state machine that can be
 * bypassed is documentation, not a guarantee — and this is the module where an
 * illegal jump means a customer charged for something that was never
 * confirmed, or an order shipped without a payment behind it.
 *
 * Pure and I/O-free on purpose, so the exhaustive matrix in
 * `tests/order-state-machine.test.ts` runs without a database or a payment
 * provider.
 */
const ORDER_STATUSES = [
  "pending_payment",
  "authorized",
  "awaiting_supplier_confirmation",
  "authorization_expired",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const satisfies readonly OrderStatus[];

/**
 * Which statuses each status may move to. Absent from a list means impossible,
 * not "unusual" — there is no escape hatch and no force flag.
 *
 * The shape of this table is the business rule:
 *
 * - An order that was never captured ends in `cancelled` or
 *   `authorization_expired`, never in `refunded` — there is no money to give
 *   back, only a hold to drop.
 * - An order that *was* captured can never fall back to `cancelled`; money
 *   already taken comes back through `refunded`.
 * - `authorized` always passes through `awaiting_supplier_confirmation`. The
 *   queue is the whole point of manual capture, so an order cannot skip it
 *   into `paid` — capture happens *because* someone confirmed.
 */
const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = Object.freeze({
  // Automatic capture succeeds → `paid`. Manual capture is authorized →
  // `authorized`. Anything else that ends the attempt → `cancelled`.
  pending_payment: ["paid", "authorized", "cancelled"],

  // Held funds, nothing charged. Either the admin queue takes it, the admin
  // drops it, or the provider's hold lapses.
  authorized: ["awaiting_supplier_confirmation", "cancelled", "authorization_expired"],

  // The admin queue: confirm with the supplier and capture, reject and cancel,
  // or let the expiry job cancel the authorization at day 6.5.
  awaiting_supplier_confirmation: ["paid", "cancelled", "authorization_expired"],

  // Money captured. Fulfilment moves forward; a refund is the only way back.
  paid: ["processing", "refunded"],
  processing: ["shipped", "refunded"],
  shipped: ["delivered", "refunded"],

  // Delivered is the end of fulfilment but **not** the end of the order: a
  // refund or a lost dispute can still follow, which is why it is not terminal.
  delivered: ["refunded"],

  // Terminal.
  authorization_expired: [],
  cancelled: [],
  refunded: [],
});

/** Spanish labels, so an error message names states the way the admin sees them. */
const STATUS_LABELS: Readonly<Record<OrderStatus, string>> = Object.freeze({
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
});

/** A status nothing can follow. `delivered` is deliberately not one of these. */
function isTerminal(status: OrderStatus): boolean {
  return ORDER_TRANSITIONS[status].length === 0;
}

/**
 * Note that `canTransition(x, x)` is **false**. Re-applying the state an order
 * is already in is not a transition, and treating it as one would let a
 * duplicated webhook append a second history entry for the same event. Callers
 * that need idempotence check `order.status === target` and return early — see
 * `applyTransition` in `order.service.ts`.
 */
function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError(
      `No se puede pasar una orden ${STATUS_LABELS[from]} a ${STATUS_LABELS[to]}.`,
      409,
    );
  }
}

export { ORDER_STATUSES, ORDER_TRANSITIONS, STATUS_LABELS, assertTransition, canTransition, isTerminal };
