import { Types } from "mongoose";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import {
  startOrderAuthorizationSweeper,
  stopOrderAuthorizationSweeper,
} from "../src/jobs/order-authorization.job.js";
import { AuditLog, InventoryItem, Order, StockReservation } from "../src/models/index.js";
import { orderMaintenanceService } from "../src/services/order-maintenance.service.js";
import { settingsService } from "../src/services/settings.service.js";
import { createAdminSession, createCustomerSession } from "./helpers/admin-session.js";
import { createInventoryItemDoc, seedAccessoryWithVariant, seedBikeWithVariant } from "./helpers/factories.js";
import { captureNextOrderPaidEmail } from "./helpers/mailer.js";
import { captureNextAdminNotification } from "./helpers/notifier.js";
import { setShippingAddress } from "./helpers/shipping.js";
import { paymentIntentObject, signStripeEvent, stubStripe } from "./helpers/stripe.js";

const CART = "/api/v1/cart";
const ORDERS = "/api/v1/orders";
const ADMIN = "/api/v1/admin";
const WEBHOOK = "/api/v1/webhooks/stripe";

const HOURS = 60 * 60 * 1000;

type App = ReturnType<typeof buildApp>;

describe("supplier confirmation and the authorization clock", () => {
  let app: App;
  let cookie: string;
  let adminCookie: string;
  let stripe: ReturnType<typeof stubStripe>;
  let onRequest: Awaited<ReturnType<typeof seedBikeWithVariant>>;

  beforeEach(async () => {
    app = buildApp();
    cookie = await createCustomerSession(app, "order-buyer@example.com");
    await setShippingAddress(app, cookie);
    adminCookie = await createAdminSession(app);
    stripe = stubStripe();
    onRequest = await seedBikeWithVariant({
      sku: "BK-SUP-M",
      fulfillmentMode: "on_request",
      price: 25_000_000,
    });

    // The sweeper now reads its interval from `Settings.jobs` on every tick
    // (M7) instead of a fixed env var — seed a short one so the real-timer
    // test below observes a tick within its wait window.
    await settingsService.updateSection(
      "jobs",
      {
        reservationReaperIntervalMs: 50,
        orderAuthSweepIntervalMs: 50,
        paymentReconciliationIntervalMs: 50,
        lowStockAlertIntervalMs: 50,
      },
      { actorType: "system" },
    );
  });

  afterEach(() => {
    stopOrderAuthorizationSweeper();
  });

  /** Walks the real flow up to an order sitting in the supplier queue. */
  async function orderAwaitingSupplier(extraLines: { itemType: "bike" | "accessory"; itemId: string; sku: string }[] = []) {
    for (const line of [{ itemType: "bike" as const, itemId: onRequest.itemId, sku: onRequest.sku }, ...extraLines]) {
      await request(app).post(`${CART}/lines`).set("Cookie", cookie).send({ ...line, qty: 1 });
    }

    const created = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });
    const orderId = created.body.data.order.id as string;
    const intentId = stripe.lastIntentId();

    const { body, signature } = signStripeEvent({
      type: "payment_intent.amount_capturable_updated",
      object: paymentIntentObject({ id: intentId, status: "requires_capture", orderId }),
    });
    await request(app).post(WEBHOOK).set("stripe-signature", signature).type("application/json").send(body);

    return { orderId, intentId };
  }

  describe("the admin confirms with the supplier", () => {
    it("captures the held funds and marks the order paid", async () => {
      const { orderId, intentId } = await orderAwaitingSupplier();

      // The admin is already looking at the order they just confirmed —
      // pinging them on their own click would be noise, so this is one of
      // the two capture methods `markPaid`'s "new sale" alert deliberately
      // never fires for (see `order.service.ts`).
      const notification = captureNextAdminNotification();

      const res = await request(app)
        .post(`${ADMIN}/orders/${orderId}/confirm-supplier-stock`)
        .set("Cookie", adminCookie)
        .send({});

      expect(res.status).toBe(200);
      expect(stripe.capturePayment).toHaveBeenCalledWith(intentId, `capture_${orderId}`);

      const order = await Order.findById(orderId).exec();
      expect(order?.status).toBe("paid");
      expect(order?.payment.state).toBe("captured");
      expect(notification.getNotification()).toBeUndefined();
    });

    it("still emails the customer that their payment was confirmed, even though the admin alert is skipped", async () => {
      const { orderId } = await orderAwaitingSupplier();
      const capture = captureNextOrderPaidEmail();

      const res = await request(app)
        .post(`${ADMIN}/orders/${orderId}/confirm-supplier-stock`)
        .set("Cookie", adminCookie)
        .send({});

      expect(res.status).toBe(200);
      const order = await Order.findById(orderId).exec();
      expect(capture.getParams()).toMatchObject({ to: "order-buyer@example.com", orderNumber: order?.orderNumber });
    });

    it("commits the in-stock line of a mixed cart out of the warehouse", async () => {
      const helmet = await seedAccessoryWithVariant({ sku: "AC-SUP-U" });
      await createInventoryItemDoc({
        itemType: "accessory",
        itemId: new Types.ObjectId(helmet.itemId),
        sku: helmet.sku,
        onHand: 4,
      });

      const { orderId } = await orderAwaitingSupplier([
        { itemType: "accessory", itemId: helmet.itemId, sku: helmet.sku },
      ]);

      await request(app)
        .post(`${ADMIN}/orders/${orderId}/confirm-supplier-stock`)
        .set("Cookie", adminCookie)
        .send({});

      const item = await InventoryItem.findOne({ sku: helmet.sku }).exec();
      expect(item).toMatchObject({ onHand: 3, reserved: 0 });
    });

    it("leaves an audit entry naming the admin who confirmed", async () => {
      const { orderId } = await orderAwaitingSupplier();

      await request(app)
        .post(`${ADMIN}/orders/${orderId}/confirm-supplier-stock`)
        .set("Cookie", adminCookie)
        .send({});

      const entry = await AuditLog.findOne({ action: "order.supplier_confirmed" }).exec();
      expect(entry).toBeTruthy();
      expect(entry?.actorType).toBe("user");
      expect(entry?.actorId).toBeTruthy();
      expect(String(entry?.targetId)).toBe(orderId);
    });

    it("is a no-op the second time — the webhook and the admin cannot both commit", async () => {
      const { orderId, intentId } = await orderAwaitingSupplier();

      await request(app)
        .post(`${ADMIN}/orders/${orderId}/confirm-supplier-stock`)
        .set("Cookie", adminCookie)
        .send({});

      // The gateway's own webhook for that capture arrives afterwards.
      const { body, signature } = signStripeEvent({
        type: "payment_intent.succeeded",
        object: paymentIntentObject({ id: intentId, orderId }),
      });
      await request(app).post(WEBHOOK).set("stripe-signature", signature).type("application/json").send(body);

      const order = await Order.findById(orderId).exec();
      expect(order?.statusHistory.filter((entry) => entry.status === "paid")).toHaveLength(1);
    });

    it("refuses to confirm an order that is not waiting on a supplier", async () => {
      await request(app)
        .post(`${CART}/lines`)
        .set("Cookie", cookie)
        .send({ itemType: "bike", itemId: onRequest.itemId, sku: onRequest.sku, qty: 1 });
      const created = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

      const res = await request(app)
        .post(`${ADMIN}/orders/${created.body.data.order.id}/confirm-supplier-stock`)
        .set("Cookie", adminCookie)
        .send({});

      expect(res.status).toBe(409);
      expect(stripe.capturePayment).not.toHaveBeenCalled();
    });
  });

  describe("the admin rejects", () => {
    it("cancels the authorization so the customer is never charged", async () => {
      const { orderId, intentId } = await orderAwaitingSupplier();

      const res = await request(app)
        .post(`${ADMIN}/orders/${orderId}/reject-supplier-stock`)
        .set("Cookie", adminCookie)
        .send({ reason: "El proveedor no tiene la talla M disponible." });

      expect(res.status).toBe(200);
      expect(stripe.cancelPayment).toHaveBeenCalledWith(intentId, `cancel_${orderId}`);
      expect(stripe.capturePayment).not.toHaveBeenCalled();

      const order = await Order.findById(orderId).exec();
      expect(order?.status).toBe("cancelled");
      expect(order?.cancelReason).toContain("talla M");
    });

    it("releases whatever the order was holding", async () => {
      const helmet = await seedAccessoryWithVariant({ sku: "AC-REJ-U" });
      await createInventoryItemDoc({
        itemType: "accessory",
        itemId: new Types.ObjectId(helmet.itemId),
        sku: helmet.sku,
        onHand: 4,
      });

      const { orderId } = await orderAwaitingSupplier([
        { itemType: "accessory", itemId: helmet.itemId, sku: helmet.sku },
      ]);

      await request(app)
        .post(`${ADMIN}/orders/${orderId}/reject-supplier-stock`)
        .set("Cookie", adminCookie)
        .send({ reason: "Sin stock en el proveedor." });

      const item = await InventoryItem.findOne({ sku: helmet.sku }).exec();
      expect(item).toMatchObject({ onHand: 4, reserved: 0 });
      expect((await StockReservation.findOne({ referenceId: orderId }).exec())?.status).toBe("released");
    });

    it("requires a reason — the customer has to be told something", async () => {
      const { orderId } = await orderAwaitingSupplier();

      const res = await request(app)
        .post(`${ADMIN}/orders/${orderId}/reject-supplier-stock`)
        .set("Cookie", adminCookie)
        .send({});

      expect(res.status).toBe(400);
      expect((await Order.findById(orderId).exec())?.status).toBe("awaiting_supplier_confirmation");
    });
  });

  describe("the expiry sweep", () => {
    /** Moves an order's authorization back in time, which is the clock the sweep reads. */
    async function backdateAuthorization(orderId: string, hoursAgo: number) {
      await Order.updateOne(
        { _id: orderId },
        { $set: { "payment.authorizedAt": new Date(Date.now() - hoursAgo * HOURS) } },
      ).exec();
    }

    it("leaves a fresh authorization alone", async () => {
      const { orderId } = await orderAwaitingSupplier();

      const result = await orderMaintenanceService.sweepAuthorizations(new Date());

      expect(result).toEqual({ alerted: 0, cancelled: 0 });
      expect((await Order.findById(orderId).exec())?.status).toBe("awaiting_supplier_confirmation");
    });

    it("warns the admin on day 5 without cancelling anything", async () => {
      const { orderId } = await orderAwaitingSupplier();
      await backdateAuthorization(orderId, 121);

      const result = await orderMaintenanceService.sweepAuthorizations(new Date());

      expect(result.alerted).toBe(1);
      expect(result.cancelled).toBe(0);

      const order = await Order.findById(orderId).exec();
      expect(order?.adminAlertedAt).toBeTruthy();
      expect(order?.status).toBe("awaiting_supplier_confirmation");
      expect(await AuditLog.countDocuments({ action: "order.authorization_expiring" })).toBe(1);
    });

    it("warns exactly once, however often it runs", async () => {
      const { orderId } = await orderAwaitingSupplier();
      await backdateAuthorization(orderId, 121);

      await orderMaintenanceService.sweepAuthorizations(new Date());
      await orderMaintenanceService.sweepAuthorizations(new Date());
      await orderMaintenanceService.sweepAuthorizations(new Date());

      expect(await AuditLog.countDocuments({ action: "order.authorization_expiring" })).toBe(1);
    });

    it("cancels the authorization on day 6.5 and gives the units back", async () => {
      const helmet = await seedAccessoryWithVariant({ sku: "AC-EXP-U" });
      await createInventoryItemDoc({
        itemType: "accessory",
        itemId: new Types.ObjectId(helmet.itemId),
        sku: helmet.sku,
        onHand: 2,
      });

      const { orderId, intentId } = await orderAwaitingSupplier([
        { itemType: "accessory", itemId: helmet.itemId, sku: helmet.sku },
      ]);
      await backdateAuthorization(orderId, 157);

      const result = await orderMaintenanceService.sweepAuthorizations(new Date());

      expect(result.cancelled).toBe(1);
      expect(stripe.cancelPayment).toHaveBeenCalledWith(intentId, `expire_${orderId}`);

      const order = await Order.findById(orderId).exec();
      expect(order?.status).toBe("authorization_expired");
      expect(order?.cancelReason).toContain("venció");

      const item = await InventoryItem.findOne({ sku: helmet.sku }).exec();
      expect(item).toMatchObject({ onHand: 2, reserved: 0 });
      expect(await AuditLog.countDocuments({ action: "order.authorization_expired" })).toBe(1);
    });

    it("never captures money on the way out — an expired hold is a non-sale", async () => {
      const { orderId } = await orderAwaitingSupplier();
      await backdateAuthorization(orderId, 200);

      await orderMaintenanceService.sweepAuthorizations(new Date());

      expect(stripe.capturePayment).not.toHaveBeenCalled();
    });

    it("runs on its own timer once the job is started", async () => {
      const { orderId } = await orderAwaitingSupplier();
      await backdateAuthorization(orderId, 200);

      // The real job, on the 50ms interval the test env configures.
      startOrderAuthorizationSweeper();

      await new Promise((resolve) => setTimeout(resolve, 300));

      expect((await Order.findById(orderId).exec())?.status).toBe("authorization_expired");
    });
  });

  describe("reconciliation when the webhook never arrives", () => {
    /** A checkout whose gateway result we simply never heard about. */
    async function orphanedCheckout() {
      await request(app)
        .post(`${CART}/lines`)
        .set("Cookie", cookie)
        .send({ itemType: "bike", itemId: onRequest.itemId, sku: onRequest.sku, qty: 1 });
      const created = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });
      const orderId = created.body.data.order.id as string;

      // Old enough to be past the grace period. Written through the raw driver
      // because Mongoose's timestamps plugin moves a `createdAt` in `$set` to
      // `$setOnInsert`, so a normal update would silently do nothing.
      await Order.collection.updateOne(
        { _id: new Types.ObjectId(orderId) },
        { $set: { createdAt: new Date(Date.now() - 2 * HOURS) } },
      );
      return orderId;
    }

    it("pays an order the gateway says was actually charged", async () => {
      const orderId = await orphanedCheckout();
      stripe.setRetrievedState("captured");

      const reconciled = await orderMaintenanceService.reconcilePendingPayments(new Date());

      expect(reconciled).toBe(1);
      expect((await Order.findById(orderId).exec())?.status).toBe("paid");
      expect(await AuditLog.countDocuments({ action: "order.reconciled" })).toBe(1);
    });

    it("queues an order the gateway says was authorized, and alerts the admin", async () => {
      const orderId = await orphanedCheckout();
      stripe.setRetrievedState("authorized");
      const notification = captureNextAdminNotification();

      await orderMaintenanceService.reconcilePendingPayments(new Date());

      expect((await Order.findById(orderId).exec())?.status).toBe("awaiting_supplier_confirmation");
      // Discovered by the sweep instead of a live webhook, but it's still the
      // first time this order needs supplier review — same alert either way.
      expect(notification.getNotification()).toMatchObject({ kind: "order.authorized" });
    });

    it("closes an order the customer simply never paid", async () => {
      const orderId = await orphanedCheckout();
      stripe.setRetrievedState("pending");

      await orderMaintenanceService.reconcilePendingPayments(new Date());

      const order = await Order.findById(orderId).exec();
      expect(order?.status).toBe("cancelled");
      expect(order?.cancelReason).toContain("no se completó");
    });

    it("ignores a checkout that is still inside its grace period", async () => {
      await request(app)
        .post(`${CART}/lines`)
        .set("Cookie", cookie)
        .send({ itemType: "bike", itemId: onRequest.itemId, sku: onRequest.sku, qty: 1 });
      const created = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

      const reconciled = await orderMaintenanceService.reconcilePendingPayments(new Date());

      expect(reconciled).toBe(0);
      expect((await Order.findById(created.body.data.order.id).exec())?.status).toBe("pending_payment");
    });

    it("changes nothing when the webhook already did the work", async () => {
      const orderId = await orphanedCheckout();
      const intentId = stripe.lastIntentId();

      const { body, signature } = signStripeEvent({
        type: "payment_intent.succeeded",
        object: paymentIntentObject({ id: intentId, orderId }),
      });
      await request(app).post(WEBHOOK).set("stripe-signature", signature).type("application/json").send(body);

      stripe.setRetrievedState("captured");
      const reconciled = await orderMaintenanceService.reconcilePendingPayments(new Date());

      // The order left `pending_payment`, so the sweep does not even see it.
      expect(reconciled).toBe(0);
      const order = await Order.findById(orderId).exec();
      expect(order?.statusHistory.filter((entry) => entry.status === "paid")).toHaveLength(1);
    });
  });
});
