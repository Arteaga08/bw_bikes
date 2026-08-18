import { logger } from "../config/logger.js";
import type { IOrder } from "../models/index.js";
import { PAYMENT_EVENT_RETENTION_DAYS, PaymentEvent } from "../models/index.js";
import { AppError } from "../utils/index.js";
import { orderService } from "./order.service.js";
import type { PaymentEventEnvelope } from "./payments/index.js";
import { assertPaymentsConfigured, getPaymentProvider } from "./payments/index.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The payment gateway's server-to-server channel — and **the only authority on
 * whether an order was paid**.
 *
 * The browser redirect that follows a payment carries no weight here: the
 * customer may close the tab, lose signal, or never be redirected at all, and
 * none of that may change whether they were charged. Conversely a redirect can
 * be forged, and this endpoint cannot.
 *
 * ## Order of operations, which is load-bearing
 *
 * 1. **Verify the signature** against the raw bytes. An unverified payload is
 *    an attacker's payload; nothing below runs until the HMAC and the
 *    timestamp tolerance both pass.
 * 2. **Claim the event id** with a unique-indexed insert, *before* dispatch. A
 *    `findOne`-then-insert would be a read-then-write, and two simultaneous
 *    redeliveries would both read "unseen". Letting the database reject the
 *    second insert is what actually serializes them.
 * 3. **Dispatch.** Handlers are idempotent on their own too, because a state
 *    change is validated against the order's current status first.
 *
 * Steps 2 and 3 are two independent guards against processing an event twice.
 * That redundancy is deliberate: this is the one place in the system where
 * being wrong means charging somebody twice or shipping stock nobody paid for.
 */

type HandlerResult = "processed" | "ignored";

/**
 * Finds the order an event belongs to.
 *
 * The gateway payment id is the primary key (unique index on
 * `payment.intentId`), with the `orderId` we attached as metadata as a
 * fallback for event shapes that reference the payment indirectly. Metadata is
 * never trusted *instead* of the id — it only helps locate the same order.
 */
async function resolveOrder(envelope: PaymentEventEnvelope): Promise<IOrder | null> {
  if (envelope.intentId) {
    const byIntent = await orderService.findByIntentId(envelope.intentId);
    if (byIntent) return byIntent;
  }

  const orderId = envelope.metadata["orderId"];
  if (!orderId) return null;

  try {
    return await orderService.findByIdOrFail(orderId);
  } catch {
    return null;
  }
}

/**
 * Best-effort: a gateway hiccup reading the card back must never block
 * `markPaid` from running — the money was already captured, that fact can't
 * wait on a display detail.
 */
async function fetchCard(
  intentId: string,
  order: IOrder,
): Promise<{ brand: string; last4: string } | undefined> {
  try {
    return (await getPaymentProvider().retrievePayment(intentId)).card;
  } catch (error) {
    logger.error({ err: error, orderId: String(order._id) }, "Could not read the card details back from the gateway");
    return undefined;
  }
}

async function dispatch(envelope: PaymentEventEnvelope, order: IOrder): Promise<HandlerResult> {
  switch (envelope.type) {
    // Manual capture: the card is authorized and the funds are held. The order
    // enters the supplier-confirmation queue and its stock holds are extended
    // to cover that wait.
    case "payment_intent.amount_capturable_updated":
      await orderService.markAuthorized(order, envelope.occurredAt);
      return "processed";

    // Money actually taken — automatic capture, or the capture the admin
    // triggered. This is the only path that removes stock from the warehouse.
    //
    // The webhook payload's own PaymentIntent is never expanded (Stripe
    // doesn't support `expand` on webhook deliveries), so the card
    // brand/last4 the admin panel shows isn't on `envelope` at all — one
    // extra round trip to the gateway on the most important event, rather
    // than leaving the order's `payment.card` empty for every automatically
    // captured order.
    case "payment_intent.succeeded": {
      const card = envelope.intentId ? await fetchCard(envelope.intentId, order) : undefined;
      await orderService.markPaid(order, envelope.occurredAt, card);
      return "processed";
    }

    case "payment_intent.payment_failed":
      await orderService.markPaymentFailed(
        order,
        envelope.failureMessage ?? "El pago fue rechazado por el proveedor.",
      );
      return "processed";

    // Distinguishes our own scheduled cancellation from anything else, so the
    // customer is told the right story.
    case "payment_intent.canceled":
      await orderService.markCanceled(
        order,
        order.status === "awaiting_supplier_confirmation" || order.status === "authorized"
          ? "authorization_expired"
          : "cancelled",
        "La autorización del pago fue cancelada.",
      );
      return "processed";

    case "charge.refunded":
      await orderService.markRefunded(order, envelope.refundedAmountCents ?? order.totalCents, envelope.occurredAt);
      return "processed";

    // A claim, not an outcome: flagged for the admin, status untouched.
    case "charge.dispute.created":
      await orderService.markDisputed(order, envelope.occurredAt);
      return "processed";

    default:
      return "ignored";
  }
}

/**
 * Handles one delivered event. Returns quietly on anything already seen or not
 * relevant — a webhook endpoint that answers non-2xx makes the provider retry,
 * so only a genuinely unverifiable request is worth rejecting.
 */
async function handleEvent(rawBody: Buffer, signature: string | undefined): Promise<void> {
  assertPaymentsConfigured();

  // Throws a 400 on a bad signature, a stale timestamp, or a tampered body.
  const envelope = getPaymentProvider().verifyWebhook(rawBody, signature);

  const purgeAt = new Date(Date.now() + PAYMENT_EVENT_RETENTION_DAYS * MS_PER_DAY);

  let record;
  try {
    record = await PaymentEvent.create({
      eventId: envelope.id,
      type: envelope.type,
      status: "ignored",
      purgeAt,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      // Already seen. This is the normal outcome of a provider retry, not a
      // problem — acknowledge and do nothing.
      logger.info({ eventId: envelope.id, type: envelope.type }, "Duplicate payment event ignored");
      return;
    }
    throw error;
  }

  const order = await resolveOrder(envelope);
  if (!order) {
    logger.warn({ eventId: envelope.id, type: envelope.type }, "Payment event matched no order");
    return;
  }

  record.orderId = order._id as never;

  try {
    record.status = await dispatch(envelope, order);
  } catch (error) {
    // The event stays recorded as seen even when its handler failed. A handler
    // that fails deterministically would otherwise fail again on every
    // redelivery, forever — the failure is surfaced in the log and on the
    // record instead, where a human can act on it.
    record.status = "failed";
    record.error = error instanceof Error ? error.message : String(error);
    logger.error({ err: error, eventId: envelope.id, orderId: String(order._id) }, "Payment event handler failed");
  } finally {
    await record.save();
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

/** Guard for a webhook route reached before Stripe was configured at all. */
function assertWebhookReady(): void {
  if (!getPaymentProvider().isConfigured) {
    throw new AppError("Los pagos no están configurados en este entorno.", 503);
  }
}

export const paymentWebhookService = { handleEvent, assertWebhookReady };
