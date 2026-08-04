import { logger } from "../config/logger.js";
import type { IOrder } from "../models/index.js";
import { Order } from "../models/index.js";
import { recordAuditLog } from "./audit-log.service.js";
import { inventoryService } from "./inventory.service.js";
import { alertThreshold, cancelThreshold, orderService, reconciliationThreshold, reservationRef } from "./order.service.js";
import { getPaymentProvider } from "./payments/index.js";

const MODULE_NAME = "orders";

/** Bounded sweeps, so a backlog can never hold the event loop (or the gateway's rate limit) hostage. */
const SWEEP_BATCH_SIZE = 200;

/**
 * The two background duties of the payment module, kept out of
 * `order.service.ts` so that file stays about what a request does.
 *
 * Both are exported as plain functions taking an explicit clock, so their
 * tests can drive them directly instead of waiting on a timer — the same shape
 * M4 used for `releaseExpiredReservations`.
 */

// --- 1. The authorization clock ------------------------------------------

/**
 * Warns the admin about an authorization that is running out of time.
 *
 * Sealed with `adminAlertedAt` so the warning fires exactly once no matter how
 * often the sweep runs. Until M15 wires real email, the audit entry *is* the
 * notification — and it is the durable record either way.
 */
async function alertExpiringAuthorizations(now: Date): Promise<number> {
  const due = await Order.find({
    status: "awaiting_supplier_confirmation",
    adminAlertedAt: { $exists: false },
    // Measured from the authorization, not from order creation: the hold is
    // what expires, and it starts when the card was authorized.
    "payment.authorizedAt": { $lte: alertThreshold(now) },
  })
    .limit(SWEEP_BATCH_SIZE)
    .exec();

  let alerted = 0;

  for (const order of due) {
    // Claiming the flag atomically is what keeps two API instances from both
    // sending the warning.
    const claimed = await Order.findOneAndUpdate(
      { _id: order._id, adminAlertedAt: { $exists: false } },
      { $set: { adminAlertedAt: now } },
      { new: true },
    ).exec();

    if (!claimed) continue;

    alerted++;
    logger.warn(
      { orderId: String(claimed._id), orderNumber: claimed.orderNumber },
      "Order authorization is close to expiring and still awaits supplier confirmation",
    );

    await recordAuditLog({
      actorType: "system",
      action: "order.authorization_expiring",
      module: MODULE_NAME,
      targetId: String(claimed._id),
      after: {
        orderNumber: claimed.orderNumber,
        authorizedAt: claimed.payment.authorizedAt?.toISOString(),
        totalCents: claimed.totalCents,
      },
    });
  }

  return alerted;
}

/**
 * Cancels an authorization before the gateway drops it on its own.
 *
 * Acting first is the entire point. Letting a hold lapse silently means
 * discovering after the fact that stock was still reserved for a payment that
 * no longer exists; cancelling deliberately releases the units and closes the
 * order at a moment we chose, with a reason the customer can be told.
 */
async function cancelExpiredAuthorizations(now: Date): Promise<number> {
  const due = await Order.find({
    status: { $in: ["authorized", "awaiting_supplier_confirmation"] },
    "payment.authorizedAt": { $lte: cancelThreshold(now) },
  })
    .limit(SWEEP_BATCH_SIZE)
    .exec();

  let cancelled = 0;

  for (const order of due) {
    try {
      if (order.payment.intentId) {
        await getPaymentProvider().cancelPayment(order.payment.intentId, `expire_${String(order._id)}`);
      }

      await orderService.markCanceled(
        order,
        "authorization_expired",
        "La autorización del pago venció antes de confirmar el stock con el proveedor.",
      );

      cancelled++;

      await recordAuditLog({
        actorType: "system",
        action: "order.authorization_expired",
        module: MODULE_NAME,
        targetId: String(order._id),
        before: { status: order.status },
        after: { status: "authorization_expired", orderNumber: order.orderNumber },
      });
    } catch (error) {
      // One stubborn order must not stop the sweep; the next tick retries it.
      logger.error(
        { err: error, orderId: String(order._id) },
        "Failed to cancel an expiring order authorization",
      );
    }
  }

  return cancelled;
}

async function sweepAuthorizations(now: Date = new Date()): Promise<{ alerted: number; cancelled: number }> {
  const alerted = await alertExpiringAuthorizations(now);
  const cancelled = await cancelExpiredAuthorizations(now);
  return { alerted, cancelled };
}

// --- 2. Reconciliation ---------------------------------------------------

/**
 * Asks the gateway what really happened to payments whose webhook never came.
 *
 * A webhook can be lost — the provider has an outage, we have one, a delivery
 * simply drops. Without this, a customer who was genuinely charged would sit
 * in `pending_payment` forever while their stock quietly expired. So after a
 * grace period the shop stops waiting to be told and goes and asks.
 *
 * Every outcome is applied through the **same** functions the webhook uses, so
 * a webhook that arrives late finds the work already done and changes nothing.
 * Duplicating the transition logic here is the one thing that would break that
 * guarantee.
 */
async function reconcilePendingPayments(now: Date = new Date()): Promise<number> {
  const stale = await Order.find({
    status: "pending_payment",
    "payment.intentId": { $exists: true },
    createdAt: { $lte: reconciliationThreshold(now) },
  })
    .limit(SWEEP_BATCH_SIZE)
    .exec();

  let reconciled = 0;

  for (const order of stale) {
    try {
      if (await reconcileOne(order)) reconciled++;
    } catch (error) {
      logger.error({ err: error, orderId: String(order._id) }, "Failed to reconcile a pending payment");
    }
  }

  return reconciled;
}

async function reconcileOne(order: IOrder): Promise<boolean> {
  const snapshot = await getPaymentProvider().retrievePayment(order.payment.intentId!);

  switch (snapshot.state) {
    case "captured":
      await orderService.markPaid(order, snapshot.capturedAt ?? new Date());
      break;

    case "authorized":
      await orderService.markAuthorized(order, snapshot.authorizedAt ?? new Date());
      break;

    case "failed":
      await orderService.markPaymentFailed(order, snapshot.lastError ?? "El pago fue rechazado.");
      break;

    case "canceled":
      await orderService.markCanceled(order, "cancelled", "El pago fue cancelado en el proveedor.");
      break;

    default:
      // Still genuinely unfinished at the gateway. The stock hold expired long
      // ago (M4's reaper saw to that), so leaving the order open would only
      // mean a customer could pay for units nobody is holding any more.
      await inventoryService.release(reservationRef(order));
      await orderService.markPaymentFailed(order, "El pago no se completó a tiempo.");
      break;
  }

  await recordAuditLog({
    actorType: "system",
    action: "order.reconciled",
    module: MODULE_NAME,
    targetId: String(order._id),
    before: { status: "pending_payment" },
    after: { orderNumber: order.orderNumber, providerState: snapshot.state },
  });

  return true;
}

export const orderMaintenanceService = {
  sweepAuthorizations,
  alertExpiringAuthorizations,
  cancelExpiredAuthorizations,
  reconcilePendingPayments,
};
