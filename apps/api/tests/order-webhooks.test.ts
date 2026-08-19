import { Types } from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { Cart, InventoryItem, Order, PaymentEvent, StockReservation } from "../src/models/index.js";
import { createCustomerSession } from "./helpers/admin-session.js";
import {
  createInventoryItemDoc,
  seedAccessoryWithVariant,
  seedBikeWithVariant,
} from "./helpers/factories.js";
import { captureNextAdminAlertEmail, captureNextOrderPaidEmail, captureNextPaymentFailedEmail, captureNextRefundConfirmedEmail } from "./helpers/mailer.js";
import { captureNextAdminNotification } from "./helpers/notifier.js";
import { setShippingAddress } from "./helpers/shipping.js";
import { chargeObject, paymentIntentObject, signStripeEvent, stubStripe } from "./helpers/stripe.js";

const CART = "/api/v1/cart";
const ORDERS = "/api/v1/orders";
const WEBHOOK = "/api/v1/webhooks/stripe";

type App = ReturnType<typeof buildApp>;

/** Posts a signed event exactly the way Stripe would: raw JSON plus the header. */
function postEvent(app: App, body: string, signature: string) {
  return request(app).post(WEBHOOK).set("stripe-signature", signature).type("application/json").send(body);
}

describe("payment webhook", () => {
  let app: App;
  let cookie: string;
  let stripe: ReturnType<typeof stubStripe>;
  let bike: Awaited<ReturnType<typeof seedBikeWithVariant>>;

  beforeEach(async () => {
    app = buildApp();
    cookie = await createCustomerSession(app, "webhook-buyer@example.com");
    await setShippingAddress(app, cookie);
    stripe = stubStripe();
    bike = await seedBikeWithVariant({ sku: "BK-WH-M", price: 19_999_900 });
    await createInventoryItemDoc({ itemId: new Types.ObjectId(bike.itemId), sku: bike.sku, onHand: 5 });
  });

  /** Runs a real checkout and returns the order plus its gateway payment id. */
  async function checkout(lines: { itemType: "bike" | "accessory"; itemId: string; sku: string; qty?: number }[]) {
    for (const line of lines) {
      await request(app)
        .post(`${CART}/lines`)
        .set("Cookie", cookie)
        .send({ ...line, qty: line.qty ?? 1 });
    }
    const res = await request(app).post(ORDERS).set("Cookie", cookie).send({});
    expect(res.status).toBe(201);
    return { orderId: res.body.data.order.id as string, intentId: stripe.lastIntentId() };
  }

  describe("signature verification", () => {
    it("rejects an unsigned request without recording anything", async () => {
      const { body } = signStripeEvent({ type: "payment_intent.succeeded", object: {} });

      const res = await request(app).post(WEBHOOK).type("application/json").send(body);

      expect(res.status).toBe(400);
      expect(await PaymentEvent.countDocuments()).toBe(0);
    });

    it("rejects a payload signed with the wrong secret", async () => {
      const { body, signature } = signStripeEvent({
        type: "payment_intent.succeeded",
        object: {},
        secret: "whsec_an_attackers_own_secret_0000000000",
      });

      const res = await postEvent(app, body, signature);

      expect(res.status).toBe(400);
      expect(await PaymentEvent.countDocuments()).toBe(0);
    });

    it("rejects a tampered body even when the signature itself is genuine", async () => {
      const { orderId, intentId } = await checkout([{ itemType: "bike", itemId: bike.itemId, sku: bike.sku }]);
      const { body, signature } = signStripeEvent({
        type: "payment_intent.succeeded",
        object: paymentIntentObject({ id: intentId, orderId }),
      });

      // One byte changed after signing.
      const tampered = body.replace("payment_intent.succeeded", "payment_intent.canceledx");

      const res = await postEvent(app, tampered, signature);

      expect(res.status).toBe(400);
      expect((await Order.findById(orderId).exec())?.status).toBe("pending_payment");
    });

    it("rejects a replayed event whose timestamp is outside the tolerance window", async () => {
      const { orderId, intentId } = await checkout([{ itemType: "bike", itemId: bike.itemId, sku: bike.sku }]);
      const { body, signature } = signStripeEvent({
        type: "payment_intent.succeeded",
        object: paymentIntentObject({ id: intentId, orderId }),
        // Tolerance is 300s; this signature is an hour old.
        timestamp: Math.floor(Date.now() / 1000) - 3600,
      });

      const res = await postEvent(app, body, signature);

      expect(res.status).toBe(400);
      expect((await Order.findById(orderId).exec())?.status).toBe("pending_payment");
    });
  });

  describe("deduplication", () => {
    it("processes an event once and ignores every redelivery of it", async () => {
      const { orderId, intentId } = await checkout([{ itemType: "bike", itemId: bike.itemId, sku: bike.sku }]);
      const { body, signature, eventId } = signStripeEvent({
        id: "evt_duplicate_me",
        type: "payment_intent.succeeded",
        object: paymentIntentObject({ id: intentId, orderId, amount: 19_999_900 }),
      });

      const first = await postEvent(app, body, signature);
      const second = await postEvent(app, body, signature);
      const third = await postEvent(app, body, signature);

      // Every delivery is acknowledged — a non-2xx would only make Stripe retry.
      expect([first.status, second.status, third.status]).toEqual([200, 200, 200]);

      expect(await PaymentEvent.countDocuments({ eventId })).toBe(1);

      const order = await Order.findById(orderId).exec();
      expect(order?.status).toBe("paid");
      // The order moved exactly once, not three times.
      expect(order?.statusHistory.filter((entry) => entry.status === "paid")).toHaveLength(1);

      // And, most importantly, stock left the warehouse exactly once.
      const item = await InventoryItem.findOne({ sku: bike.sku }).exec();
      expect(item?.onHand).toBe(4);
      expect(item?.reserved).toBe(0);
    });

    it("survives two simultaneous redeliveries of the same event", async () => {
      const { orderId, intentId } = await checkout([{ itemType: "bike", itemId: bike.itemId, sku: bike.sku }]);
      const { body, signature } = signStripeEvent({
        id: "evt_race",
        type: "payment_intent.succeeded",
        object: paymentIntentObject({ id: intentId, orderId }),
      });

      await Promise.all([postEvent(app, body, signature), postEvent(app, body, signature)]);

      expect(await PaymentEvent.countDocuments({ eventId: "evt_race" })).toBe(1);
      const item = await InventoryItem.findOne({ sku: bike.sku }).exec();
      expect(item?.onHand).toBe(4);
    });

    it("does not confuse two different events for the same payment", async () => {
      const { orderId, intentId } = await checkout([{ itemType: "bike", itemId: bike.itemId, sku: bike.sku }]);

      const authorized = signStripeEvent({
        type: "payment_intent.amount_capturable_updated",
        object: paymentIntentObject({ id: intentId, status: "requires_capture", orderId }),
      });
      const succeeded = signStripeEvent({
        type: "payment_intent.succeeded",
        object: paymentIntentObject({ id: intentId, orderId }),
      });

      await postEvent(app, authorized.body, authorized.signature);
      await postEvent(app, succeeded.body, succeeded.signature);

      expect(await PaymentEvent.countDocuments()).toBe(2);
      expect((await Order.findById(orderId).exec())?.status).toBe("paid");
    });
  });

  describe("payment_intent.succeeded", () => {
    it("marks the order paid and commits the stock out of the warehouse", async () => {
      const { orderId, intentId } = await checkout([
        { itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 2 },
      ]);

      const before = await InventoryItem.findOne({ sku: bike.sku }).exec();
      expect(before).toMatchObject({ onHand: 5, reserved: 2 });

      const { body, signature } = signStripeEvent({
        type: "payment_intent.succeeded",
        object: paymentIntentObject({ id: intentId, orderId }),
      });
      await postEvent(app, body, signature);

      const order = await Order.findById(orderId).exec();
      expect(order?.status).toBe("paid");
      expect(order?.payment.state).toBe("captured");
      expect(order?.payment.capturedAt).toBeTruthy();

      const after = await InventoryItem.findOne({ sku: bike.sku }).exec();
      expect(after).toMatchObject({ onHand: 3, reserved: 0 });
      expect((await StockReservation.findOne({ referenceId: orderId }).exec())?.status).toBe("committed");
    });

    it("empties the cart only now, once the money actually arrived", async () => {
      const { orderId, intentId } = await checkout([{ itemType: "bike", itemId: bike.itemId, sku: bike.sku }]);
      expect((await Cart.findOne({}).exec())?.lines).toHaveLength(1);

      const { body, signature } = signStripeEvent({
        type: "payment_intent.succeeded",
        object: paymentIntentObject({ id: intentId, orderId }),
      });
      await postEvent(app, body, signature);

      expect((await Cart.findOne({}).exec())?.lines).toEqual([]);
    });

    it("alerts the admin of a new automatic sale", async () => {
      const { orderId, intentId } = await checkout([{ itemType: "bike", itemId: bike.itemId, sku: bike.sku }]);
      const notification = captureNextAdminNotification();

      const { body, signature } = signStripeEvent({
        type: "payment_intent.succeeded",
        object: paymentIntentObject({ id: intentId, orderId }),
      });
      await postEvent(app, body, signature);

      expect(notification.getNotification()).toMatchObject({ kind: "order.paid" });
    });

    it("also alerts the admin by email, alongside Telegram, with who and what to prepare", async () => {
      const { orderId, intentId } = await checkout([{ itemType: "bike", itemId: bike.itemId, sku: bike.sku }]);
      const adminEmail = captureNextAdminAlertEmail();

      const { body, signature } = signStripeEvent({
        type: "payment_intent.succeeded",
        object: paymentIntentObject({ id: intentId, orderId }),
      });
      await postEvent(app, body, signature);

      const params = adminEmail.getParams();
      expect(params).toMatchObject({ subject: expect.stringContaining("Nueva venta") });
      const bodyText = params!.bodyParagraphs.join("\n");
      // Who to ship it to — the recipient's name, account email and phone —
      // and what to pull off the shelf, not just "a sale happened."
      expect(bodyText).toContain("Ana García");
      expect(bodyText).toContain("webhook-buyer@example.com");
      expect(bodyText).toContain("5512345678");
      expect(bodyText).toContain(bike.sku);
    });

    it("emails the customer that their payment was confirmed", async () => {
      const { orderId, intentId } = await checkout([{ itemType: "bike", itemId: bike.itemId, sku: bike.sku }]);
      const capture = captureNextOrderPaidEmail();

      const { body, signature } = signStripeEvent({
        type: "payment_intent.succeeded",
        object: paymentIntentObject({ id: intentId, orderId }),
      });
      await postEvent(app, body, signature);

      const order = await Order.findById(orderId).exec();
      expect(capture.getParams()).toMatchObject({
        to: "webhook-buyer@example.com",
        orderNumber: order?.orderNumber,
        totalCents: order?.totalCents,
      });
    });
  });

  describe("payment_intent.amount_capturable_updated (manual capture)", () => {
    it("moves the order into the supplier queue through both recorded hops", async () => {
      const onRequest = await seedBikeWithVariant({ sku: "BK-WH-REQ", fulfillmentMode: "on_request" });
      const { orderId, intentId } = await checkout([
        { itemType: "bike", itemId: onRequest.itemId, sku: onRequest.sku },
      ]);
      const notification = captureNextAdminNotification();

      const { body, signature } = signStripeEvent({
        type: "payment_intent.amount_capturable_updated",
        object: paymentIntentObject({ id: intentId, status: "requires_capture", orderId }),
      });
      await postEvent(app, body, signature);

      const order = await Order.findById(orderId).exec();
      expect(order?.status).toBe("awaiting_supplier_confirmation");
      expect(order?.payment.state).toBe("authorized");
      expect(order?.payment.authorizedAt).toBeTruthy();
      expect(order?.payment.authorizationExpiresAt).toBeTruthy();

      // The diagram's two hops are both in the history, not collapsed into one.
      expect(order?.statusHistory.map((entry) => entry.status)).toEqual([
        "pending_payment",
        "authorized",
        "awaiting_supplier_confirmation",
      ]);
      expect(notification.getNotification()).toMatchObject({ kind: "order.authorized" });
    });

    it("extends the in-stock hold of a mixed cart past the checkout deadline", async () => {
      const onRequest = await seedBikeWithVariant({ sku: "BK-WH-MIX", fulfillmentMode: "on_request" });
      const helmet = await seedAccessoryWithVariant({ sku: "AC-WH-U" });
      await createInventoryItemDoc({
        itemType: "accessory",
        itemId: new Types.ObjectId(helmet.itemId),
        sku: helmet.sku,
        onHand: 3,
      });

      const { orderId, intentId } = await checkout([
        { itemType: "bike", itemId: onRequest.itemId, sku: onRequest.sku },
        { itemType: "accessory", itemId: helmet.itemId, sku: helmet.sku },
      ]);

      const held = await StockReservation.findOne({ referenceId: orderId }).exec();
      const originalDeadline = held!.expiresAt;

      const { body, signature } = signStripeEvent({
        type: "payment_intent.amount_capturable_updated",
        object: paymentIntentObject({ id: intentId, status: "requires_capture", orderId }),
      });
      await postEvent(app, body, signature);

      // Without this, the helmet would be handed back 15 minutes in, while the
      // made-to-order bike is still being confirmed with the supplier.
      const extended = await StockReservation.findById(held!._id).exec();
      expect(extended!.expiresAt.getTime()).toBeGreaterThan(originalDeadline.getTime());
      expect(extended!.status).toBe("held");
      const daysOut = (extended!.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      expect(daysOut).toBeGreaterThan(6);
    });

    it("does not touch stock — an authorization is not a sale", async () => {
      const { orderId, intentId } = await checkout([{ itemType: "bike", itemId: bike.itemId, sku: bike.sku }]);

      const { body, signature } = signStripeEvent({
        type: "payment_intent.amount_capturable_updated",
        object: paymentIntentObject({ id: intentId, status: "requires_capture", orderId }),
      });
      await postEvent(app, body, signature);

      const item = await InventoryItem.findOne({ sku: bike.sku }).exec();
      expect(item).toMatchObject({ onHand: 5, reserved: 1 });
    });
  });

  describe("failure paths", () => {
    it("cancels the order and gives the units back when the payment fails", async () => {
      const { orderId, intentId } = await checkout([
        { itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 2 },
      ]);

      const { body, signature } = signStripeEvent({
        type: "payment_intent.payment_failed",
        object: paymentIntentObject({
          id: intentId,
          status: "requires_payment_method",
          orderId,
          lastError: "Tu tarjeta fue rechazada.",
        }),
      });
      await postEvent(app, body, signature);

      const order = await Order.findById(orderId).exec();
      expect(order?.status).toBe("cancelled");
      expect(order?.payment.state).toBe("failed");
      expect(order?.cancelReason).toContain("rechazada");

      const item = await InventoryItem.findOne({ sku: bike.sku }).exec();
      expect(item).toMatchObject({ onHand: 5, reserved: 0 });
      expect((await StockReservation.findOne({ referenceId: orderId }).exec())?.status).toBe("released");
    });

    it("emails the customer that the payment failed, without mentioning a refund", async () => {
      const { orderId, intentId } = await checkout([{ itemType: "bike", itemId: bike.itemId, sku: bike.sku }]);
      const capture = captureNextPaymentFailedEmail();

      const { body, signature } = signStripeEvent({
        type: "payment_intent.payment_failed",
        object: paymentIntentObject({
          id: intentId,
          status: "requires_payment_method",
          orderId,
          lastError: "Tu tarjeta fue rechazada.",
        }),
      });
      await postEvent(app, body, signature);

      const order = await Order.findById(orderId).exec();
      expect(capture.getParams()).toMatchObject({ to: "webhook-buyer@example.com", orderNumber: order?.orderNumber });
    });

    it("records a cancelled authorization as expired, not as a plain cancellation", async () => {
      const onRequest = await seedBikeWithVariant({ sku: "BK-WH-EXP", fulfillmentMode: "on_request" });
      const { orderId, intentId } = await checkout([
        { itemType: "bike", itemId: onRequest.itemId, sku: onRequest.sku },
      ]);

      const authorized = signStripeEvent({
        type: "payment_intent.amount_capturable_updated",
        object: paymentIntentObject({ id: intentId, status: "requires_capture", orderId }),
      });
      await postEvent(app, authorized.body, authorized.signature);

      const canceled = signStripeEvent({
        type: "payment_intent.canceled",
        object: paymentIntentObject({ id: intentId, status: "canceled", orderId }),
      });
      await postEvent(app, canceled.body, canceled.signature);

      expect((await Order.findById(orderId).exec())?.status).toBe("authorization_expired");
    });
  });

  describe("post-payment events", () => {
    async function paidOrder() {
      const { orderId, intentId } = await checkout([{ itemType: "bike", itemId: bike.itemId, sku: bike.sku }]);
      const { body, signature } = signStripeEvent({
        type: "payment_intent.succeeded",
        object: paymentIntentObject({ id: intentId, orderId }),
      });
      await postEvent(app, body, signature);
      return { orderId, intentId };
    }

    it("marks a refunded charge as refunded, with its amount", async () => {
      const { orderId, intentId } = await paidOrder();

      const { body, signature } = signStripeEvent({
        type: "charge.refunded",
        object: chargeObject({ intentId, amountRefunded: 19_999_900, orderId }),
      });
      await postEvent(app, body, signature);

      const order = await Order.findById(orderId).exec();
      expect(order?.status).toBe("refunded");
      expect(order?.payment.refundedAmountCents).toBe(19_999_900);
    });

    it("emails the customer that the refund was confirmed", async () => {
      const { orderId, intentId } = await paidOrder();
      const capture = captureNextRefundConfirmedEmail();

      const { body, signature } = signStripeEvent({
        type: "charge.refunded",
        object: chargeObject({ intentId, amountRefunded: 19_999_900, orderId }),
      });
      await postEvent(app, body, signature);

      const order = await Order.findById(orderId).exec();
      expect(capture.getParams()).toMatchObject({
        to: "webhook-buyer@example.com",
        orderNumber: order?.orderNumber,
        refundedAmountCents: 19_999_900,
      });
    });

    it("flags a dispute without changing the status — a claim is not an outcome", async () => {
      const { orderId, intentId } = await paidOrder();

      const { body, signature } = signStripeEvent({
        type: "charge.dispute.created",
        object: { id: "dp_test_1", object: "dispute", payment_intent: intentId, metadata: { orderId } },
      });
      const res = await postEvent(app, body, signature);

      expect(res.status).toBe(200);
      const order = await Order.findById(orderId).exec();
      expect(order?.disputedAt).toBeTruthy();
      // Money has not moved back yet; only a later refund event would say so.
      expect(order?.status).toBe("paid");
    });
  });

  describe("events it has nothing to do with", () => {
    it("acknowledges an unrelated event type and records it as ignored", async () => {
      const { orderId, intentId } = await checkout([{ itemType: "bike", itemId: bike.itemId, sku: bike.sku }]);

      const { body, signature, eventId } = signStripeEvent({
        type: "payment_intent.created",
        object: paymentIntentObject({ id: intentId, status: "requires_payment_method", orderId }),
      });
      const res = await postEvent(app, body, signature);

      expect(res.status).toBe(200);
      expect((await PaymentEvent.findOne({ eventId }).exec())?.status).toBe("ignored");
      expect((await Order.findById(orderId).exec())?.status).toBe("pending_payment");
    });

    it("acknowledges an event for a payment it has never seen", async () => {
      const { body, signature } = signStripeEvent({
        type: "payment_intent.succeeded",
        object: paymentIntentObject({ id: "pi_never_created_here" }),
      });

      const res = await postEvent(app, body, signature);

      expect(res.status).toBe(200);
      expect(await Order.countDocuments()).toBe(0);
    });
  });

  it("finds the order by the gateway payment id, not by trusting the metadata", async () => {
    const { orderId, intentId } = await checkout([{ itemType: "bike", itemId: bike.itemId, sku: bike.sku }]);

    // Metadata pointing at somebody else's order must not redirect the event.
    const { body, signature } = signStripeEvent({
      type: "payment_intent.succeeded",
      object: paymentIntentObject({ id: intentId, orderId: new Types.ObjectId().toString() }),
    });
    await postEvent(app, body, signature);

    expect((await Order.findById(orderId).exec())?.status).toBe("paid");
  });
});
