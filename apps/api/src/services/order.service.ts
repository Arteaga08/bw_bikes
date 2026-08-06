import { randomInt } from "node:crypto";
import type {
  AdminOrder,
  AdminOrderStatusHistoryEntry,
  BillingInfo,
  Carrier,
  CheckoutResult,
  OrderLineSnapshot,
  OrderStatus,
  PublicOrder,
  ShippingAddress,
} from "@bw-bikes/shared";
import { Types } from "mongoose";
import { logger } from "../config/logger.js";
import type { IOrder, IUser } from "../models/index.js";
import { Order } from "../models/index.js";
import { AppError, buildMeta, parseListQuery } from "../utils/index.js";
import { recordAuditLog } from "./audit-log.service.js";
import { cartService } from "./cart.service.js";
import type { ReservationLine } from "./inventory.service.js";
import { inventoryService } from "./inventory.service.js";
import { assertTransition, canTransition, isTerminal } from "./order-state.js";
import { buildLineSnapshots, calculateTotals, resolveCaptureMethod } from "./order-pricing.js";
import { assertPaymentsConfigured, getPaymentProvider } from "./payments/index.js";
import type { ActorContext } from "./product.service.js";
import { settingsService } from "./settings.service.js";
import { shippingService } from "./shipping.service.js";

const MODULE_NAME = "orders";

const SORTABLE_FIELDS = ["createdAt", "totalCents", "status"] as const;

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

/** Collision on a random order number is vanishingly unlikely; retrying twice is free insurance. */
const ORDER_NUMBER_ATTEMPTS = 5;

/** Unambiguous alphabet: no I/O/0/1, because these numbers get read out over the phone. */
const ORDER_NUMBER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ORDER_NUMBER_LENGTH = 6;

interface CreateOrderInput {
  idempotencyKey?: string | undefined;
}

/** Who caused a status change. Jobs and the payment webhook have no human behind them. */
interface TransitionActor {
  actorType: "user" | "system";
  actorId?: string | undefined;
  reason?: string | undefined;
}

function generateOrderNumber(): string {
  let suffix = "";
  for (let i = 0; i < ORDER_NUMBER_LENGTH; i++) {
    suffix += ORDER_NUMBER_ALPHABET[randomInt(ORDER_NUMBER_ALPHABET.length)];
  }
  return `BW-${new Date().getFullYear()}-${suffix}`;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

/** Only `in_stock` lines have units to hold; the rest are the order's own problem (M4's contract). */
function toReservationLines(lines: OrderLineSnapshot[]): ReservationLine[] {
  return lines.map((line) => ({
    itemType: line.itemType,
    itemId: line.itemId,
    sku: line.sku,
    qty: line.qty,
    fulfillmentMode: line.fulfillmentMode,
  }));
}

function reservationRef(order: IOrder) {
  return { referenceType: "order" as const, referenceId: String(order._id) };
}

// --- DTOs -----------------------------------------------------------------

function toPublicOrder(order: IOrder): PublicOrder {
  return {
    id: String(order._id),
    orderNumber: order.orderNumber,
    status: order.status,
    lines: order.lines,
    totals: {
      subtotalCents: order.subtotalCents,
      taxCents: order.taxCents,
      shippingCents: order.shippingCents,
      totalCents: order.totalCents,
      currency: order.currency,
    },
    payment: {
      provider: order.payment.provider,
      state: order.payment.state,
      captureMethod: order.payment.captureMethod,
      ...(order.payment.authorizedAt ? { authorizedAt: order.payment.authorizedAt.toISOString() } : {}),
      ...(order.payment.capturedAt ? { capturedAt: order.payment.capturedAt.toISOString() } : {}),
      ...(order.payment.authorizationExpiresAt
        ? { authorizationExpiresAt: order.payment.authorizationExpiresAt.toISOString() }
        : {}),
    },
    shippingAddress: order.shippingAddress,
    ...(order.billingInfo ? { billingInfo: order.billingInfo } : {}),
    ...(order.shipment
      ? {
          shipment: {
            carrier: order.shipment.carrier,
            ...(order.shipment.carrierName !== undefined ? { carrierName: order.shipment.carrierName } : {}),
            trackingNumber: order.shipment.trackingNumber,
            trackingUrl: order.shipment.trackingUrl,
            shippedAt: order.shipment.shippedAt.toISOString(),
          },
        }
      : {}),
    statusHistory: order.statusHistory.map((entry) => ({
      status: entry.status,
      at: entry.at.toISOString(),
      actorType: entry.actorType,
      ...(entry.reason !== undefined ? { reason: entry.reason } : {}),
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

/**
 * The admin view adds who bought it and the gateway's own id, so an operator
 * can cross-reference the payment in the provider dashboard. Never served on a
 * customer route — `payment.intentId` is not secret, but it is not the
 * customer's business either.
 */
function toAdminOrder(order: IOrder, customer?: Pick<IUser, "_id" | "email" | "firstName" | "lastName"> | null): AdminOrder {
  // The admin panel needs to say *who* moved the order, so `actorId` rides
  // along here — `toPublicOrder`'s mapping omits it, correctly, for the
  // customer's own view of the same history.
  const statusHistory: AdminOrderStatusHistoryEntry[] = order.statusHistory.map((entry) => ({
    status: entry.status,
    at: entry.at.toISOString(),
    actorType: entry.actorType,
    ...(entry.actorId !== undefined ? { actorId: String(entry.actorId) } : {}),
    ...(entry.reason !== undefined ? { reason: entry.reason } : {}),
  }));

  return {
    ...toPublicOrder(order),
    statusHistory,
    customer: customer
      ? {
          id: String(customer._id),
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName,
        }
      : null,
    ...(order.payment.intentId !== undefined ? { paymentIntentId: order.payment.intentId } : {}),
    ...(order.disputedAt ? { disputedAt: order.disputedAt.toISOString() } : {}),
    ...(order.adminAlertedAt ? { adminAlertedAt: order.adminAlertedAt.toISOString() } : {}),
    ...(order.cancelReason !== undefined ? { cancelReason: order.cancelReason } : {}),
  };
}

// --- The state machine, applied ------------------------------------------

/**
 * Moves an order to `to`, or reports that it didn't need moving.
 *
 * Three properties make this the only way `status` is ever written:
 *
 * 1. **Idempotent.** An order already at `to` returns `false` without touching
 *    anything. This is what lets a redelivered webhook, a reconciliation job
 *    and an admin action all run the same code path without stacking history
 *    entries or double-committing inventory.
 * 2. **Validated.** `assertTransition` refuses any edge the state machine does
 *    not have. There is no force flag.
 * 3. **Atomic.** The current status is in the *filter*, so two concurrent
 *    callers cannot both apply the same transition — Mongo serializes them and
 *    the loser gets `null`, which is reported as "already handled" rather than
 *    as an error.
 */
async function applyTransition(
  order: IOrder,
  to: OrderStatus,
  actor: TransitionActor,
  extra: Record<string, unknown> = {},
): Promise<IOrder | null> {
  if (order.status === to) return null;

  assertTransition(order.status, to);

  const now = new Date();
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    {
      $set: { status: to, ...extra },
      $push: {
        statusHistory: {
          status: to,
          at: now,
          actorType: actor.actorType,
          ...(actor.actorId !== undefined ? { actorId: new Types.ObjectId(actor.actorId) } : {}),
          ...(actor.reason !== undefined ? { reason: actor.reason } : {}),
        },
      },
    },
    { new: true },
  ).exec();

  if (!updated) {
    // Someone else moved it between our read and our write. Not an error: both
    // callers wanted the order to progress, and one of them did.
    logger.info({ orderId: String(order._id), to }, "Order transition lost a race; skipping");
  }

  return updated;
}

// --- Checkout -------------------------------------------------------------

/**
 * Turns the customer's cart into an order and a payment intent.
 *
 * ## Why this is a saga and not a transaction
 *
 * Step 3 is a network call to the payment gateway. A Mongo transaction held
 * open across a third party's latency holds locks for the duration of someone
 * else's outage, which is how a replica set falls over. So the steps run in
 * order, each with explicit compensation:
 *
 *   1. price + freeze lines   (pure; nothing to undo)
 *   2. create the Order       (its _id is what the reservation references)
 *   3. hold stock             → 409 ⇒ cancel the order, re-raise
 *   4. create the payment     → error ⇒ release the holds, cancel the order
 *
 * A process that dies mid-way is covered without any compensation running: the
 * holds carry a 15-minute deadline and M4's reaper takes them back, while the
 * orphaned `pending_payment` order is closed by the reconciliation job.
 *
 * ## Amounts
 *
 * Every peso here comes from `order-pricing.ts`, which reads the catalog.
 * Nothing in the request body contributes to `totalCents`, and the gateway is
 * handed that server-computed number.
 */
async function createFromCart(userId: string, input: CreateOrderInput, actor: ActorContext): Promise<CheckoutResult> {
  assertPaymentsConfigured();

  // A retry of the same intent must resolve to the same order, not a second
  // one — checked before anything is created or held.
  if (input.idempotencyKey) {
    const replay = await Order.findOne({ userId, idempotencyKey: input.idempotencyKey }).exec();
    if (replay) return replayCheckout(replay);
  }

  // Captured on the cart, ahead of payment — `createOrderSchema` takes no
  // body, so this is the only source for it. A checkout with nowhere to ship
  // is refused before a single unit is held or Stripe is ever called.
  const shippingAddress = await cartService.getShippingAddress(userId);
  if (!shippingAddress) {
    throw new AppError("Agrega una dirección de envío antes de continuar.", 400);
  }

  // Optional CFDI data (M7) — copied as a snapshot exactly like the shipping
  // address, but never required: an order is valid with none of it.
  const billingInfo = await cartService.getBillingInfo(userId);

  const lines = await cartService.getCheckoutLines(userId);
  const snapshots = await buildLineSnapshots(lines);
  const settings = await settingsService.get();
  const shippingQuote = shippingService.quote(snapshots, settings.shipping);
  const totals = calculateTotals(snapshots, shippingQuote.shippingCents, settings.pricing.taxRateBps);
  const captureMethod = resolveCaptureMethod(snapshots);

  // One live checkout per customer. A second attempt supersedes the first
  // rather than stacking beside it — otherwise an indecisive customer would
  // hold the same bike three times over and lock out real buyers.
  await cancelStalePendingOrders(userId);

  const order = await createOrderDocument({
    userId,
    snapshots,
    totals,
    captureMethod,
    shippingAddress,
    ...(billingInfo !== undefined ? { billingInfo } : {}),
    ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
  });

  try {
    await inventoryService.reserve(toReservationLines(snapshots), {
      referenceType: "order",
      referenceId: String(order._id),
      userId,
      ttlMinutes: settings.orders.orderPaymentTtlMinutes,
    });
  } catch (error) {
    await failOrder(order, "No hay unidades suficientes para completar la compra.");
    throw error;
  }

  try {
    const payment = await getPaymentProvider().createPayment({
      amountCents: totals.totalCents,
      currency: totals.currency,
      captureMethod,
      // Derived from the order id, so a retried network call maps to the same
      // gateway payment even when our own request never got a response.
      idempotencyKey: `order_${String(order._id)}`,
      metadata: { orderId: String(order._id), orderNumber: order.orderNumber },
      requestThreeDSecure: settings.orders.requestThreeDSecure,
      shippingAddress,
    });

    order.payment.intentId = payment.intentId;
    await order.save();

    await recordAuditLog({
      actorId: actor.actorId,
      actorType: "user",
      action: "order.created",
      module: MODULE_NAME,
      targetId: String(order._id),
      after: {
        orderNumber: order.orderNumber,
        totalCents: order.totalCents,
        captureMethod,
        lines: snapshots.length,
      },
      ip: actor.ip,
    });

    return { order: toPublicOrder(order), clientSecret: payment.clientSecret };
  } catch (error) {
    await inventoryService.release(reservationRef(order));
    await failOrder(order, "No se pudo iniciar el pago.");
    throw error;
  }
}

/**
 * Answers a repeated checkout request with the order it already produced.
 *
 * The client secret is not stored anywhere — it is a bearer credential for the
 * payment, and a database that holds it is a database that can leak it. It is
 * recovered instead by asking the gateway to create the payment again with the
 * *same* provider idempotency key, which by definition returns the original
 * payment rather than a second one — **as long as that key is still live**.
 * Stripe only remembers an idempotency key for ~24h; a replay after that
 * window gets back a genuinely new PaymentIntent instead. When the id Stripe
 * hands back differs from the one already on the order, it is persisted here
 * — otherwise the unique partial index on `payment.intentId` (order.model.ts)
 * would keep pointing at a payment nobody can complete any more, and the
 * webhook would have to fall back to matching by `metadata.orderId` instead of
 * finding the order directly.
 */
async function replayCheckout(order: IOrder): Promise<CheckoutResult> {
  if (order.status !== "pending_payment") {
    throw new AppError(`La orden ${order.orderNumber} ya fue procesada.`, 409);
  }

  const settings = await settingsService.get();
  const payment = await getPaymentProvider().createPayment({
    amountCents: order.totalCents,
    currency: order.currency,
    captureMethod: order.payment.captureMethod,
    idempotencyKey: `order_${String(order._id)}`,
    metadata: { orderId: String(order._id), orderNumber: order.orderNumber },
    requestThreeDSecure: settings.orders.requestThreeDSecure,
    shippingAddress: order.shippingAddress,
  });

  if (payment.intentId !== order.payment.intentId) {
    order.payment.intentId = payment.intentId;
    await order.save();
  }

  return { order: toPublicOrder(order), clientSecret: payment.clientSecret };
}

async function createOrderDocument(params: {
  userId: string;
  snapshots: OrderLineSnapshot[];
  totals: ReturnType<typeof calculateTotals>;
  captureMethod: "automatic" | "manual";
  shippingAddress: ShippingAddress;
  billingInfo?: BillingInfo;
  idempotencyKey?: string;
}): Promise<IOrder> {
  for (let attempt = 0; attempt < ORDER_NUMBER_ATTEMPTS; attempt++) {
    try {
      return await Order.create({
        orderNumber: generateOrderNumber(),
        userId: params.userId,
        status: "pending_payment",
        lines: params.snapshots,
        subtotalCents: params.totals.subtotalCents,
        taxCents: params.totals.taxCents,
        shippingCents: params.totals.shippingCents,
        totalCents: params.totals.totalCents,
        currency: params.totals.currency,
        payment: { provider: "stripe", state: "pending", captureMethod: params.captureMethod },
        shippingAddress: params.shippingAddress,
        ...(params.billingInfo !== undefined ? { billingInfo: params.billingInfo } : {}),
        ...(params.idempotencyKey !== undefined ? { idempotencyKey: params.idempotencyKey } : {}),
        statusHistory: [{ status: "pending_payment", at: new Date(), actorType: "user" }],
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;

      // Two customers can collide on an idempotency key only within their own
      // scope, so a duplicate on that index means *this* customer raced
      // themselves — hand back the order the other request created.
      if (params.idempotencyKey) {
        const existing = await Order.findOne({
          userId: params.userId,
          idempotencyKey: params.idempotencyKey,
        }).exec();
        if (existing) return existing;
      }
      // Otherwise it was the order number; try another one.
    }
  }

  throw new AppError("No se pudo generar la orden. Intenta de nuevo.", 500);
}

/** Closes an order that never got off the ground. Best-effort: never masks the original failure. */
async function failOrder(order: IOrder, reason: string): Promise<void> {
  try {
    await applyTransition(order, "cancelled", { actorType: "system", reason }, {
      cancelReason: reason,
      "payment.state": "failed",
    });
  } catch (error) {
    logger.error({ err: error, orderId: String(order._id) }, "Failed to cancel an order after a checkout failure");
  }
}

/**
 * Drops any earlier checkout the same customer left hanging, giving its stock
 * back immediately instead of waiting out the 15-minute deadline.
 *
 * The superseded order's PaymentIntent is cancelled at the gateway *before*
 * the order itself is marked `cancelled` — mirroring
 * `cancelExpiredAuthorizations` (order-maintenance.service.ts), the sibling
 * flow that already gets this right. Skipping that call would leave the old
 * `clientSecret` live: a customer who still has the superseded checkout tab
 * open could complete that payment after this function returns, and the
 * resulting `payment_intent.succeeded` webhook would try `cancelled → paid`,
 * a transition the state machine refuses (order-state.ts) — money captured
 * with no order left to receive it.
 */
async function cancelStalePendingOrders(userId: string): Promise<void> {
  const stale = await Order.find({ userId, status: "pending_payment" }).exec();

  for (const order of stale) {
    if (order.payment.intentId) {
      try {
        await getPaymentProvider().cancelPayment(order.payment.intentId, `cancel_${String(order._id)}`);
      } catch (error) {
        // A payment already captured, or a gateway hiccup, must not stop the
        // stock release below — but it does mean this order must not be
        // superseded silently, since the card may still be chargeable.
        logger.error(
          { err: error, orderId: String(order._id) },
          "Could not cancel a superseded order's payment intent before replacing it",
        );
        continue;
      }
    }

    await inventoryService.release(reservationRef(order));
    await applyTransition(
      order,
      "cancelled",
      { actorType: "system", reason: "Reemplazada por un nuevo intento de compra." },
      { cancelReason: "Reemplazada por un nuevo intento de compra.", "payment.state": "canceled" },
    );
  }
}

// --- Payment outcomes (webhook and reconciliation share these) ------------

/**
 * Funds are held, nothing charged: the order enters the admin queue.
 *
 * Both hops of the spec's diagram are recorded — `pending_payment →
 * authorized → awaiting_supplier_confirmation` — rather than collapsing them,
 * so the history shows *when the card was authorized* separately from *when
 * the shop started waiting on its supplier*.
 *
 * The reservation deadline is pushed out to the authorization's own lifetime
 * here. Without that, the in-stock helmet of a mixed cart would be handed back
 * 15 minutes in, while the made-to-order bike is still being confirmed.
 */
async function markAuthorized(order: IOrder, authorizedAt: Date): Promise<void> {
  const provider = getPaymentProvider();
  let authorizationExpiresAt: Date | undefined;

  if (order.payment.intentId) {
    try {
      // The gateway knows how long it will hold the funds; we do not guess.
      const snapshot = await provider.retrievePayment(order.payment.intentId);
      authorizationExpiresAt = snapshot.authorizationExpiresAt;
    } catch (error) {
      logger.error({ err: error, orderId: String(order._id) }, "Could not read the authorization window");
    }
  }

  const authorized = await applyTransition(order, "authorized", { actorType: "system" }, {
    "payment.state": "authorized",
    "payment.authorizedAt": authorizedAt,
    ...(authorizationExpiresAt ? { "payment.authorizationExpiresAt": authorizationExpiresAt } : {}),
  });

  const current = authorized ?? (await Order.findById(order._id).exec());
  if (!current) return;

  if (authorizationExpiresAt) {
    await inventoryService.extendHold(reservationRef(current), authorizationExpiresAt);
  }

  await applyTransition(current, "awaiting_supplier_confirmation", { actorType: "system" });

  // The purchase is committed from the customer's side, so the shopping list
  // has done its job.
  await cartService.emptyAfterCheckout(String(current.userId));

  await recordAuditLog({
    actorType: "system",
    action: "order.authorized",
    module: MODULE_NAME,
    targetId: String(current._id),
    after: { orderNumber: current.orderNumber, totalCents: current.totalCents },
  });
}

/**
 * Money captured. This is the only place inventory actually leaves the
 * warehouse (`commit`), and it is reached from a webhook or from the gateway's
 * synchronous response to an admin capture — never from a browser redirect.
 */
async function markPaid(order: IOrder, capturedAt: Date): Promise<void> {
  const updated = await applyTransition(order, "paid", { actorType: "system" }, {
    "payment.state": "captured",
    "payment.capturedAt": capturedAt,
  });

  if (!updated) return;

  await inventoryService.commit(reservationRef(updated));
  await cartService.emptyAfterCheckout(String(updated.userId));

  await recordAuditLog({
    actorType: "system",
    action: "order.paid",
    module: MODULE_NAME,
    targetId: String(updated._id),
    after: { orderNumber: updated.orderNumber, totalCents: updated.totalCents },
  });
}

/** The payment attempt ended without money. Holds go back; the order closes. */
async function markPaymentFailed(order: IOrder, reason: string): Promise<void> {
  await inventoryService.release(reservationRef(order));
  await applyTransition(order, "cancelled", { actorType: "system", reason }, {
    cancelReason: reason,
    "payment.state": "failed",
  });
}

/**
 * The authorization was dropped. `authorization_expired` when our own expiry
 * job did it, `cancelled` when a human did — the two are different stories for
 * the customer, and collapsing them would lose the reason.
 */
async function markCanceled(order: IOrder, target: "cancelled" | "authorization_expired", reason: string): Promise<void> {
  await inventoryService.release(reservationRef(order));

  if (!canTransition(order.status, target)) return;

  await applyTransition(order, target, { actorType: "system", reason }, {
    cancelReason: reason,
    "payment.state": "canceled",
  });
}

async function markRefunded(order: IOrder, refundedAmountCents: number, refundedAt: Date): Promise<void> {
  const updated = await applyTransition(order, "refunded", { actorType: "system" }, {
    "payment.state": "refunded",
    "payment.refundedAmountCents": refundedAmountCents,
    "payment.refundedAt": refundedAt,
  });

  if (!updated) return;

  await recordAuditLog({
    actorType: "system",
    action: "order.refunded",
    module: MODULE_NAME,
    targetId: String(updated._id),
    after: { orderNumber: updated.orderNumber, refundedAmountCents },
  });
}

/**
 * A chargeback was opened. Deliberately **not** a status change: a dispute is
 * a claim, not an outcome, and money has not moved yet. The order is flagged
 * so the admin can act; if it is later lost, the resulting refund event moves
 * the status.
 */
async function markDisputed(order: IOrder, occurredAt: Date): Promise<void> {
  await Order.updateOne({ _id: order._id }, { $set: { disputedAt: occurredAt } }).exec();

  await recordAuditLog({
    actorType: "system",
    action: "order.disputed",
    module: MODULE_NAME,
    targetId: String(order._id),
    after: { orderNumber: order.orderNumber, disputedAt: occurredAt.toISOString() },
  });
}

// --- Admin actions --------------------------------------------------------

/**
 * The owner confirmed with the supplier: take the money that has been held.
 *
 * ## On "only the webhook decides paid"
 *
 * That rule exists to keep a **browser** from declaring a payment successful —
 * a redirect is attacker-controlled and may never happen. A capture call is
 * the opposite: an authenticated server-to-server request whose response comes
 * straight from the gateway. Acting on it is safe, and refusing to would leave
 * the admin staring at an unchanged order until a webhook happens to arrive.
 *
 * The webhook still arrives, and still runs `markPaid` — which finds the order
 * already `paid` and does nothing. Two paths, one outcome, no double commit.
 */
async function confirmSupplierStock(orderId: string, actor: ActorContext): Promise<PublicOrder> {
  assertPaymentsConfigured();
  const order = await findByIdOrFail(orderId);

  if (order.status !== "awaiting_supplier_confirmation") {
    throw new AppError("Esta orden no está esperando confirmación del proveedor.", 409);
  }
  if (!order.payment.intentId) {
    throw new AppError("Esta orden no tiene un pago asociado.", 409);
  }

  const snapshot = await getPaymentProvider().capturePayment(
    order.payment.intentId,
    `capture_${String(order._id)}`,
  );

  if (snapshot.state !== "captured") {
    throw new AppError("El proveedor de pagos no confirmó la captura.", 502);
  }

  await markPaid(order, snapshot.capturedAt ?? new Date());

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "order.supplier_confirmed",
    module: MODULE_NAME,
    targetId: String(order._id),
    before: { status: order.status },
    after: { status: "paid", orderNumber: order.orderNumber },
    ip: actor.ip,
  });

  return toPublicOrder(await findByIdOrFail(orderId));
}

/** No stock at the supplier: drop the authorization so the customer is never charged. */
async function rejectSupplierStock(orderId: string, reason: string, actor: ActorContext): Promise<PublicOrder> {
  assertPaymentsConfigured();
  const order = await findByIdOrFail(orderId);

  if (order.status !== "awaiting_supplier_confirmation") {
    throw new AppError("Esta orden no está esperando confirmación del proveedor.", 409);
  }
  if (!order.payment.intentId) {
    throw new AppError("Esta orden no tiene un pago asociado.", 409);
  }

  await getPaymentProvider().cancelPayment(order.payment.intentId, `cancel_${String(order._id)}`);
  await markCanceled(order, "cancelled", reason);

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "order.supplier_rejected",
    module: MODULE_NAME,
    targetId: String(order._id),
    before: { status: order.status },
    after: { status: "cancelled", reason, orderNumber: order.orderNumber },
    ip: actor.ip,
  });

  return toPublicOrder(await findByIdOrFail(orderId));
}

/** An order past this point has already told the customer where it went; the address is frozen. */
const SHIPPING_ADDRESS_FROZEN_STATUSES: OrderStatus[] = ["shipped", "delivered"];

/**
 * Corrects or captures the destination on an order the customer already
 * placed. Refused once the package has actually shipped or been delivered
 * (or the order is otherwise closed) — correcting an address after the fact
 * would be lying about where a package went, not fixing a typo before it
 * left.
 */
async function updateShippingAddress(
  orderId: string,
  address: ShippingAddress,
  actor: ActorContext,
): Promise<PublicOrder> {
  const order = await findByIdOrFail(orderId);

  if (SHIPPING_ADDRESS_FROZEN_STATUSES.includes(order.status) || isTerminal(order.status)) {
    throw new AppError(
      `No se puede modificar la dirección de envío de una orden en estatus "${order.status}".`,
      409,
    );
  }

  const before = order.shippingAddress;
  order.shippingAddress = address;
  await order.save();

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "order.shipping_address_updated",
    module: MODULE_NAME,
    targetId: String(order._id),
    before,
    after: address,
    ip: actor.ip,
  });

  return toPublicOrder(order);
}

interface RecordShipmentInput {
  carrier: Carrier;
  carrierName?: string;
  trackingNumber: string;
  /** Built from `carrier` + `trackingNumber` when the client didn't supply one. */
  trackingUrl?: string;
}

/** Once shipped, corrections are in place — nobody "reships" a package over a mistyped tracking number. */
const SHIPMENT_CORRECTABLE_STATUSES: OrderStatus[] = ["shipped", "delivered"];

/**
 * Captures the courier and guide number for an order, or corrects them
 * afterward. Which of the two happens is decided by the order's own status,
 * not by a flag the caller passes:
 *
 * - `processing` → captures the shipment **and** drives `processing → shipped`
 *   in the same `applyTransition` call, so the tracking data and the status
 *   change land together or not at all, and only one history entry is
 *   written.
 * - `shipped` / `delivered` → correction only. `status` is untouched.
 * - anything else → 409; nobody ships an order that hasn't been confirmed paid.
 */
async function recordShipment(orderId: string, input: RecordShipmentInput, actor: ActorContext): Promise<PublicOrder> {
  const order = await findByIdOrFail(orderId);

  const trackingUrl = input.trackingUrl ?? shippingService.buildTrackingUrl(input.carrier, input.trackingNumber);
  if (!trackingUrl) {
    throw new AppError("Indica la URL de rastreo para esta paquetería.", 400);
  }

  const shipmentFields: Record<string, unknown> = {
    "shipment.carrier": input.carrier,
    "shipment.trackingNumber": input.trackingNumber,
    "shipment.trackingUrl": trackingUrl,
    ...(input.carrierName !== undefined ? { "shipment.carrierName": input.carrierName } : {}),
  };

  if (order.status === "processing") {
    const updated = await applyTransition(
      order,
      "shipped",
      { actorType: "user", actorId: actor.actorId },
      { ...shipmentFields, "shipment.shippedAt": new Date() },
    );

    if (!updated) {
      throw new AppError("La orden ya fue actualizada por otra solicitud. Intenta de nuevo.", 409);
    }

    await recordAuditLog({
      actorId: actor.actorId,
      actorType: "user",
      action: "order.shipped",
      module: MODULE_NAME,
      targetId: String(updated._id),
      after: { orderNumber: updated.orderNumber, carrier: input.carrier, trackingNumber: input.trackingNumber },
      ip: actor.ip,
    });

    return toPublicOrder(updated);
  }

  if (SHIPMENT_CORRECTABLE_STATUSES.includes(order.status)) {
    const before = order.shipment;
    const updated = await Order.findOneAndUpdate({ _id: order._id }, { $set: shipmentFields }, { new: true }).exec();
    if (!updated) {
      throw new AppError("La orden no existe.", 404);
    }

    await recordAuditLog({
      actorId: actor.actorId,
      actorType: "user",
      action: "order.shipment_updated",
      module: MODULE_NAME,
      targetId: String(updated._id),
      before,
      after: { orderNumber: updated.orderNumber, carrier: input.carrier, trackingNumber: input.trackingNumber },
      ip: actor.ip,
    });

    return toPublicOrder(updated);
  }

  throw new AppError(`No se puede capturar la guía de una orden en estatus "${order.status}".`, 409);
}

/**
 * Statuses reachable from the bulk endpoint. `shipped` is excluded because it
 * requires a per-order tracking number (`recordShipment` is the only door to
 * it); `cancelled` and `refunded` are excluded because they move money and
 * stock, which is not a batch operation.
 */
const BULK_ALLOWED_STATUSES: OrderStatus[] = ["processing", "delivered"];

interface BulkStatusResultItem {
  id: string;
  orderNumber: string;
  outcome: "updated" | "unchanged" | "rejected";
  message?: string;
}

interface BulkStatusResult {
  results: BulkStatusResultItem[];
  summary: { updated: number; unchanged: number; rejected: number };
}

/**
 * Moves many orders to the same status in one request, over `applyTransition`
 * — never a `$set`/`updateMany`, which would bypass the state machine
 * entirely. Each order is independent: one order's 409 does not abort the
 * rest, and the outcome of every order is reported back rather than thrown,
 * so the caller can render "38 updated, 2 already there, 1 rejected" instead
 * of an all-or-nothing failure.
 */
async function bulkUpdateStatus(
  orderIds: string[],
  status: OrderStatus,
  reason: string | undefined,
  actor: ActorContext,
): Promise<BulkStatusResult> {
  if (!BULK_ALLOWED_STATUSES.includes(status)) {
    throw new AppError(`El estatus "${status}" no se puede aplicar de forma masiva.`, 400);
  }

  const results: BulkStatusResultItem[] = [];
  const summary = { updated: 0, unchanged: 0, rejected: 0 };

  for (const orderId of orderIds) {
    let order: IOrder;
    try {
      order = await findByIdOrFail(orderId);
    } catch (error) {
      const message = error instanceof AppError ? error.message : "La orden no existe.";
      results.push({ id: orderId, orderNumber: "", outcome: "rejected", message });
      summary.rejected++;
      continue;
    }

    try {
      const updated = await applyTransition(
        order,
        status,
        { actorType: "user", actorId: actor.actorId, ...(reason !== undefined ? { reason } : {}) },
      );

      if (!updated) {
        results.push({ id: orderId, orderNumber: order.orderNumber, outcome: "unchanged" });
        summary.unchanged++;
        continue;
      }

      results.push({ id: orderId, orderNumber: updated.orderNumber, outcome: "updated" });
      summary.updated++;

      // Per order, not one entry for the whole batch — so the audit viewer
      // (M11) can filter by `targetId` and find exactly this order's history.
      await recordAuditLog({
        actorId: actor.actorId,
        actorType: "user",
        action: "order.bulk_status_updated",
        module: MODULE_NAME,
        targetId: String(updated._id),
        before: { status: order.status },
        after: { status, orderNumber: updated.orderNumber, ...(reason !== undefined ? { reason } : {}) },
        ip: actor.ip,
      });
    } catch (error) {
      const message = error instanceof AppError ? error.message : "No se pudo actualizar esta orden.";
      results.push({ id: orderId, orderNumber: order.orderNumber, outcome: "rejected", message });
      summary.rejected++;
    }
  }

  return { results, summary };
}

// --- Reads ----------------------------------------------------------------

async function findByIdOrFail(orderId: string): Promise<IOrder> {
  if (!Types.ObjectId.isValid(orderId)) {
    throw new AppError("La orden no existe.", 404);
  }
  const order = await Order.findById(orderId).exec();
  if (!order) {
    throw new AppError("La orden no existe.", 404);
  }
  return order;
}

/**
 * Anti-IDOR: the owner is part of the **filter**, not a check performed after
 * loading. A missing match answers 404 rather than 403 — a 403 would confirm
 * that someone else's order exists at that id, which is exactly the fact an
 * enumeration attempt is after.
 */
async function getForUser(userId: string, orderId: string): Promise<PublicOrder> {
  if (!Types.ObjectId.isValid(orderId)) {
    throw new AppError("La orden no existe.", 404);
  }

  const order = await Order.findOne({ _id: orderId, userId }).exec();
  if (!order) {
    throw new AppError("La orden no existe.", 404);
  }
  return toPublicOrder(order);
}

async function listForUser(userId: string, query: Record<string, unknown>) {
  const { page, limit, skip, sort } = parseListQuery(query, {
    allowedSortFields: SORTABLE_FIELDS,
    defaultSort: "-createdAt",
  });

  const filter: Record<string, unknown> = { userId };
  const status = query["status"];
  if (typeof status === "string") filter["status"] = status;

  const [documents, total] = await Promise.all([
    Order.find(filter).sort(sort).skip(skip).limit(limit).exec(),
    Order.countDocuments(filter).exec(),
  ]);

  return { orders: documents.map(toPublicOrder), meta: buildMeta(total, page, limit) };
}

/** Named filters only — the client's query object never becomes a Mongo filter. */
async function listForAdmin(query: Record<string, unknown>) {
  const { page, limit, skip, sort } = parseListQuery(query, {
    allowedSortFields: SORTABLE_FIELDS,
    defaultSort: "-createdAt",
  });

  const filter: Record<string, unknown> = {};
  const status = query["status"];
  if (typeof status === "string") filter["status"] = status;

  const orderNumber = query["orderNumber"];
  if (typeof orderNumber === "string") filter["orderNumber"] = orderNumber.toUpperCase();

  const [documents, total] = await Promise.all([
    Order.find(filter).sort(sort).skip(skip).limit(limit).populate("userId", "email firstName lastName").exec(),
    Order.countDocuments(filter).exec(),
  ]);

  return {
    orders: documents.map((order) =>
      toAdminOrder(order, order.populated("userId") ? (order.userId as unknown as IUser) : null),
    ),
    meta: buildMeta(total, page, limit),
  };
}

async function getForAdmin(orderId: string): Promise<AdminOrder> {
  if (!Types.ObjectId.isValid(orderId)) {
    throw new AppError("La orden no existe.", 404);
  }
  const order = await Order.findById(orderId).populate("userId", "email firstName lastName").exec();
  if (!order) {
    throw new AppError("La orden no existe.", 404);
  }
  return toAdminOrder(order, order.populated("userId") ? (order.userId as unknown as IUser) : null);
}

/** The lookup the payment webhook performs: from a gateway payment id to our order. */
async function findByIntentId(intentId: string): Promise<IOrder | null> {
  return Order.findOne({ "payment.intentId": intentId }).exec();
}

// --- Deadlines (used by the background jobs) -----------------------------

/**
 * The three thresholds below take their hours/minutes as a parameter rather
 * than reading `Settings` themselves — same reasoning as
 * `order-pricing.ts`'s `calculateTotals`: they stay pure and synchronous,
 * cheaply unit-testable, and the two real callers
 * (`stats/alerts.stats.ts`, `order-maintenance.service.ts`) fetch `Settings`
 * once per sweep/request and pass the live value down.
 */
function alertThreshold(now: Date, orderAuthAlertHours: number): Date {
  return new Date(now.getTime() - orderAuthAlertHours * MS_PER_HOUR);
}

function cancelThreshold(now: Date, orderAuthCancelHours: number): Date {
  return new Date(now.getTime() - orderAuthCancelHours * MS_PER_HOUR);
}

function reconciliationThreshold(now: Date, paymentReconciliationAfterMinutes: number): Date {
  return new Date(now.getTime() - paymentReconciliationAfterMinutes * MS_PER_MINUTE);
}

export const orderService = {
  createFromCart,
  confirmSupplierStock,
  rejectSupplierStock,
  updateShippingAddress,
  recordShipment,
  bulkUpdateStatus,
  getForUser,
  listForUser,
  getForAdmin,
  listForAdmin,
  findByIdOrFail,
  findByIntentId,
  markAuthorized,
  markPaid,
  markPaymentFailed,
  markCanceled,
  markRefunded,
  markDisputed,
  applyTransition,
};

export type { BulkStatusResult, CreateOrderInput, RecordShipmentInput, TransitionActor };
export {
  alertThreshold,
  BULK_ALLOWED_STATUSES,
  cancelThreshold,
  reconciliationThreshold,
  reservationRef,
  toAdminOrder,
  toPublicOrder,
};
