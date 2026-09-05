import { Types } from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { Cart, InventoryItem, Order, StockReservation } from "../src/models/index.js";
import { createCustomerSession } from "./helpers/admin-session.js";
import {
  createInventoryItemDoc,
  seedAccessoryWithVariant,
  seedBikeWithVariant,
} from "./helpers/factories.js";
import { setShippingAddress } from "./helpers/shipping.js";
import { stubStripe } from "./helpers/stripe.js";

const CART = "/api/v1/cart";
const ORDERS = "/api/v1/orders";

async function addToCart(
  app: ReturnType<typeof buildApp>,
  cookie: string,
  line: { itemType: "bike" | "accessory"; itemId: string; sku: string; qty?: number },
) {
  return request(app)
    .post(`${CART}/lines`)
    .set("Cookie", cookie)
    .send({ ...line, qty: line.qty ?? 1 });
}

describe("checkout", () => {
  let app: ReturnType<typeof buildApp>;
  let cookie: string;
  let bike: Awaited<ReturnType<typeof seedBikeWithVariant>>;

  beforeEach(async () => {
    app = buildApp();
    cookie = await createCustomerSession(app, "buyer@example.com");
    await setShippingAddress(app, cookie);
    bike = await seedBikeWithVariant({ sku: "BK-CO-M", price: 19_999_900 });
    await createInventoryItemDoc({ itemId: new Types.ObjectId(bike.itemId), sku: bike.sku, onHand: 3 });
  });

  it("creates an order whose total the server computed, and returns a client secret", async () => {
    stubStripe();
    await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 2 });

    const res = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

    expect(res.status).toBe(201);
    expect(res.body.data.order.totals.totalCents).toBe(39_999_800);
    expect(res.body.data.order.totals.taxCents).toBe(Math.round((39_999_800 * 1600) / 11_600));
    expect(res.body.data.order.status).toBe("pending_payment");
    expect(res.body.data.clientSecret).toBeTruthy();
    expect(res.body.data.order.orderNumber).toMatch(/^BW-\d{4}-[A-Z2-9]{6}$/);
  });

  it("asks the gateway for the amount it calculated, never one from the request", async () => {
    const stripe = stubStripe();
    await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 });

    // A hostile client trying every obvious way to dictate the charge.
    await request(app)
      .post(ORDERS)
      .set("Cookie", cookie)
      .send({
        totalCents: 1,
        amount: 1,
        totals: { totalCents: 1 },
        currency: "USD",
        termsAcceptedAt: new Date().toISOString(),
      });

    expect(stripe.createPayment).toHaveBeenCalledTimes(1);
    expect(stripe.createPayment.mock.calls[0]![0]).toMatchObject({
      amountCents: 19_999_900,
      currency: "MXN",
    });
  });

  it("passes the 3D Secure policy from Settings and the cart's shipping address to the gateway", async () => {
    const stripe = stubStripe();
    await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });

    const res = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

    expect(res.status).toBe(201);
    expect(stripe.createPayment.mock.calls[0]![0]).toMatchObject({
      requestThreeDSecure: "automatic",
      shippingAddress: expect.objectContaining({ postalCode: expect.any(String) }),
    });
  });

  it("holds stock for the order, on the checkout deadline and not the generic one", async () => {
    stubStripe();
    await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 2 });

    const res = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

    const item = await InventoryItem.findOne({ sku: bike.sku }).exec();
    expect(item?.reserved).toBe(2);

    const reservation = await StockReservation.findOne({ referenceId: res.body.data.order.id }).exec();
    expect(reservation?.status).toBe("held");
    // 15 minutes, per ORDER_PAYMENT_TTL_MINUTES — not the 30 of the generic TTL.
    const minutes = (reservation!.expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(13);
    expect(minutes).toBeLessThan(16);
  });

  it("does not empty the cart until the payment actually lands", async () => {
    stubStripe();
    await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 });

    await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

    // Losing the cart the instant an order is created would punish every
    // customer whose card is then declined.
    const cart = await Cart.findOne({}).exec();
    expect(cart?.lines).toHaveLength(1);
  });

  describe("the mixed-cart rule", () => {
    it("puts a made-to-order bike and an in-stock helmet in ONE manual-capture order", async () => {
      const stripe = stubStripe();
      const onRequest = await seedBikeWithVariant({
        sku: "BK-REQ-XL",
        fulfillmentMode: "on_request",
        price: 25_000_000,
      });
      const helmet = await seedAccessoryWithVariant({ sku: "AC-MIX-U", price: 4_500_00 });
      await createInventoryItemDoc({
        itemType: "accessory",
        itemId: new Types.ObjectId(helmet.itemId),
        sku: helmet.sku,
        onHand: 4,
      });

      await addToCart(app, cookie, { itemType: "bike", itemId: onRequest.itemId, sku: onRequest.sku });
      await addToCart(app, cookie, { itemType: "accessory", itemId: helmet.itemId, sku: helmet.sku });

      const res = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

      expect(res.status).toBe(201);
      // One order, not two — the purchase is never split into two payments.
      expect(await Order.countDocuments()).toBe(1);
      expect(res.body.data.order.lines).toHaveLength(2);
      expect(res.body.data.order.payment.captureMethod).toBe("manual");
      expect(stripe.createPayment.mock.calls[0]![0]).toMatchObject({ captureMethod: "manual" });

      // Only the helmet has units to hold; the bike has none by definition.
      const reservations = await StockReservation.find({}).exec();
      expect(reservations).toHaveLength(1);
      expect(reservations[0]?.sku).toBe("AC-MIX-U");
    });

    it("treats a preorder line exactly like a made-to-order one", async () => {
      const stripe = stubStripe();
      const preorder = await seedBikeWithVariant({ sku: "BK-PRE-M", fulfillmentMode: "preorder" });

      await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });
      await addToCart(app, cookie, { itemType: "bike", itemId: preorder.itemId, sku: preorder.sku });

      await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

      expect(stripe.createPayment.mock.calls[0]![0]).toMatchObject({ captureMethod: "manual" });
    });

    it("captures automatically when every line is in stock", async () => {
      const stripe = stubStripe();
      await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });

      await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

      expect(stripe.createPayment.mock.calls[0]![0]).toMatchObject({ captureMethod: "automatic" });
    });
  });

  describe("idempotency", () => {
    it("returns the same order for a repeated key instead of creating a second one", async () => {
      stubStripe();
      await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });

      const first = await request(app)
        .post(ORDERS)
        .set("Cookie", cookie)
        .set("Idempotency-Key", "checkout-abc-123")
        .send({ termsAcceptedAt: new Date().toISOString() });
      const second = await request(app)
        .post(ORDERS)
        .set("Cookie", cookie)
        .set("Idempotency-Key", "checkout-abc-123")
        .send({ termsAcceptedAt: new Date().toISOString() });

      expect(second.body.data.order.id).toBe(first.body.data.order.id);
      expect(await Order.countDocuments()).toBe(1);
      // And the stock was held exactly once.
      expect((await InventoryItem.findOne({ sku: bike.sku }).exec())?.reserved).toBe(1);
    });

    it("passes the same idempotency key to the gateway so it cannot double-charge", async () => {
      const stripe = stubStripe();
      await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });

      const res = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

      expect(stripe.createPayment.mock.calls[0]![0]).toMatchObject({
        idempotencyKey: `order_${res.body.data.order.id}`,
      });
    });

    it("persists a new intentId when the gateway's idempotency key has expired and it minted a fresh PaymentIntent", async () => {
      // Stripe only remembers a provider idempotency key for ~24h. A replay
      // past that window returns a genuinely new PaymentIntent rather than the
      // original — regression test for `payment.intentId` being left pointing
      // at the old, uncompletable one.
      const stripe = stubStripe();
      await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });

      const first = await request(app)
        .post(ORDERS)
        .set("Cookie", cookie)
        .set("Idempotency-Key", "checkout-expired-key")
        .send({ termsAcceptedAt: new Date().toISOString() });
      const originalIntentId = (await Order.findById(first.body.data.order.id).exec())?.payment.intentId;

      // Simulate the key having expired at Stripe: the next call to
      // createPayment (the replay) mints a brand new intent instead of
      // resolving to the one already recorded.
      const freshIntentId = "pi_test_replayed_fresh";
      stripe.createPayment.mockResolvedValueOnce({
        intentId: freshIntentId,
        clientSecret: `${freshIntentId}_secret_test`,
        state: "pending",
        amountCents: 19_999_900,
      });

      const second = await request(app)
        .post(ORDERS)
        .set("Cookie", cookie)
        .set("Idempotency-Key", "checkout-expired-key")
        .send({ termsAcceptedAt: new Date().toISOString() });

      expect(second.body.data.order.id).toBe(first.body.data.order.id);
      const updated = await Order.findById(first.body.data.order.id).exec();
      expect(updated?.payment.intentId).toBe(freshIntentId);
      expect(updated?.payment.intentId).not.toBe(originalIntentId);
    });

    it("lets two different customers use the same key without colliding", async () => {
      stubStripe();
      const other = await createCustomerSession(app, "buyer2@example.com");
      await setShippingAddress(app, other);

      await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });
      await addToCart(app, other, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });

      const a = await request(app).post(ORDERS).set("Cookie", cookie).set("Idempotency-Key", "same").send({ termsAcceptedAt: new Date().toISOString() });
      const b = await request(app).post(ORDERS).set("Cookie", other).set("Idempotency-Key", "same").send({ termsAcceptedAt: new Date().toISOString() });

      expect(a.status).toBe(201);
      expect(b.status).toBe(201);
      expect(a.body.data.order.id).not.toBe(b.body.data.order.id);
    });
  });

  describe("when stock runs out", () => {
    it("refuses with 409 and leaves nothing held", async () => {
      stubStripe();
      await InventoryItem.updateOne({ sku: bike.sku }, { $set: { onHand: 1 } }).exec();
      await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 3 });

      const res = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

      expect(res.status).toBe(409);
      const item = await InventoryItem.findOne({ sku: bike.sku }).exec();
      expect(item?.reserved).toBe(0);
      expect(await StockReservation.countDocuments({ status: "held" })).toBe(0);
    });

    it("cancels the order it had already created, rather than leaving it hanging", async () => {
      stubStripe();
      await InventoryItem.updateOne({ sku: bike.sku }, { $set: { onHand: 0 } }).exec();
      await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });

      await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

      const order = await Order.findOne({}).exec();
      expect(order?.status).toBe("cancelled");
      expect(order?.cancelReason).toBeTruthy();
    });

    it("gives the last unit to exactly one of two simultaneous checkouts", async () => {
      stubStripe();
      await InventoryItem.updateOne({ sku: bike.sku }, { $set: { onHand: 1 } }).exec();

      const other = await createCustomerSession(app, "rival@example.com");
      await setShippingAddress(app, other);
      await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });
      await addToCart(app, other, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });

      const [a, b] = await Promise.all([
        request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() }),
        request(app).post(ORDERS).set("Cookie", other).send({ termsAcceptedAt: new Date().toISOString() }),
      ]);

      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual([201, 409]);

      // The invariant that matters more than either response.
      const item = await InventoryItem.findOne({ sku: bike.sku }).exec();
      expect(item!.reserved).toBe(1);
      expect(item!.onHand - item!.reserved).toBe(0);
      expect(item!.onHand).toBeGreaterThanOrEqual(0);
      expect(item!.reserved).toBeGreaterThanOrEqual(0);
    });
  });

  it("supersedes an abandoned checkout instead of stacking holds", async () => {
    stubStripe();
    await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });

    const first = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });
    const second = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

    expect(second.status).toBe(201);
    expect(second.body.data.order.id).not.toBe(first.body.data.order.id);

    // The abandoned attempt gave its units back immediately, rather than
    // locking out real buyers until its 15-minute deadline.
    const stale = await Order.findById(first.body.data.order.id).exec();
    expect(stale?.status).toBe("cancelled");
    expect((await InventoryItem.findOne({ sku: bike.sku }).exec())?.reserved).toBe(1);
  });

  it("cancels the superseded checkout's PaymentIntent at the gateway, not only locally", async () => {
    // Regression test: a superseded order used to be marked `cancelled`
    // without ever telling Stripe, leaving its old clientSecret chargeable.
    // If the customer completed that stale payment afterwards, the resulting
    // webhook would try `cancelled -> paid`, which the state machine refuses —
    // money captured with no order left to receive it.
    const stripe = stubStripe();
    await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });

    const first = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });
    await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });
    await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

    const staleOrder = await Order.findById(first.body.data.order.id).exec();
    expect(stripe.cancelPayment).toHaveBeenCalledWith(
      staleOrder?.payment.intentId,
      `cancel_${String(staleOrder?._id)}`,
    );
  });

  it("does not supersede (and keeps the reservation) when the gateway refuses to cancel the old intent", async () => {
    // If Stripe reports the superseded PaymentIntent can no longer be
    // cancelled (e.g. it was already captured), the order must not be
    // silently marked `cancelled` — the reconciliation job is left to resolve
    // it against whatever the gateway actually did.
    const stripe = stubStripe();
    stripe.cancelPayment.mockRejectedValueOnce(new Error("already captured"));
    await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });

    const first = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });
    await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });
    await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

    const staleOrder = await Order.findById(first.body.data.order.id).exec();
    expect(staleOrder?.status).toBe("pending_payment");
  });

  it("lets only one of two simultaneous checkout attempts by the same customer create a pending order", async () => {
    // "One live checkout per customer" (order.service.ts's createFromCart) is
    // enforced by cancelStalePendingOrders, which reads existing orders before
    // deciding to cancel them. Two requests racing through it both read "no
    // stale order yet" and both proceed — this pins the fix: a partial unique
    // index on {userId, pending_payment} is what actually closes the window.
    stubStripe();
    await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });

    const [a, b] = await Promise.all([
      request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() }),
      request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect(await Order.countDocuments({ status: "pending_payment" })).toBe(1);
  });

  it("still lets an abandoned checkout be followed by a new one, sequentially", async () => {
    stubStripe();
    await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });

    const first = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });
    const second = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect((await Order.findById(first.body.data.order.id).exec())?.status).toBe("cancelled");
    expect(await Order.countDocuments({ status: "pending_payment" })).toBe(1);
  });

  it("refuses an empty cart", async () => {
    stubStripe();
    const res = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });
    expect(res.status).toBe(400);
  });

  it("refuses a cart whose product was archived while the customer browsed", async () => {
    stubStripe();
    await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });
    await bike.bike.updateOne({ isActive: false, archivedAt: new Date() });

    const res = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("BK-CO-M");
  });

  it("requires authentication", async () => {
    const res = await request(app).post(ORDERS).send({ termsAcceptedAt: new Date().toISOString() });
    expect(res.status).toBe(401);
  });
});
