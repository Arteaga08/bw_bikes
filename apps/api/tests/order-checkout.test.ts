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

    const res = await request(app).post(ORDERS).set("Cookie", cookie).send({});

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
      .send({ totalCents: 1, amount: 1, totals: { totalCents: 1 }, currency: "USD" });

    expect(stripe.createPayment).toHaveBeenCalledTimes(1);
    expect(stripe.createPayment.mock.calls[0]![0]).toMatchObject({
      amountCents: 19_999_900,
      currency: "MXN",
    });
  });

  it("holds stock for the order, on the checkout deadline and not the generic one", async () => {
    stubStripe();
    await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 2 });

    const res = await request(app).post(ORDERS).set("Cookie", cookie).send({});

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

    await request(app).post(ORDERS).set("Cookie", cookie).send({});

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

      const res = await request(app).post(ORDERS).set("Cookie", cookie).send({});

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

      await request(app).post(ORDERS).set("Cookie", cookie).send({});

      expect(stripe.createPayment.mock.calls[0]![0]).toMatchObject({ captureMethod: "manual" });
    });

    it("captures automatically when every line is in stock", async () => {
      const stripe = stubStripe();
      await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });

      await request(app).post(ORDERS).set("Cookie", cookie).send({});

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
        .send({});
      const second = await request(app)
        .post(ORDERS)
        .set("Cookie", cookie)
        .set("Idempotency-Key", "checkout-abc-123")
        .send({});

      expect(second.body.data.order.id).toBe(first.body.data.order.id);
      expect(await Order.countDocuments()).toBe(1);
      // And the stock was held exactly once.
      expect((await InventoryItem.findOne({ sku: bike.sku }).exec())?.reserved).toBe(1);
    });

    it("passes the same idempotency key to the gateway so it cannot double-charge", async () => {
      const stripe = stubStripe();
      await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });

      const res = await request(app).post(ORDERS).set("Cookie", cookie).send({});

      expect(stripe.createPayment.mock.calls[0]![0]).toMatchObject({
        idempotencyKey: `order_${res.body.data.order.id}`,
      });
    });

    it("lets two different customers use the same key without colliding", async () => {
      stubStripe();
      const other = await createCustomerSession(app, "buyer2@example.com");
      await setShippingAddress(app, other);

      await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });
      await addToCart(app, other, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });

      const a = await request(app).post(ORDERS).set("Cookie", cookie).set("Idempotency-Key", "same").send({});
      const b = await request(app).post(ORDERS).set("Cookie", other).set("Idempotency-Key", "same").send({});

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

      const res = await request(app).post(ORDERS).set("Cookie", cookie).send({});

      expect(res.status).toBe(409);
      const item = await InventoryItem.findOne({ sku: bike.sku }).exec();
      expect(item?.reserved).toBe(0);
      expect(await StockReservation.countDocuments({ status: "held" })).toBe(0);
    });

    it("cancels the order it had already created, rather than leaving it hanging", async () => {
      stubStripe();
      await InventoryItem.updateOne({ sku: bike.sku }, { $set: { onHand: 0 } }).exec();
      await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });

      await request(app).post(ORDERS).set("Cookie", cookie).send({});

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
        request(app).post(ORDERS).set("Cookie", cookie).send({}),
        request(app).post(ORDERS).set("Cookie", other).send({}),
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

    const first = await request(app).post(ORDERS).set("Cookie", cookie).send({});
    const second = await request(app).post(ORDERS).set("Cookie", cookie).send({});

    expect(second.status).toBe(201);
    expect(second.body.data.order.id).not.toBe(first.body.data.order.id);

    // The abandoned attempt gave its units back immediately, rather than
    // locking out real buyers until its 15-minute deadline.
    const stale = await Order.findById(first.body.data.order.id).exec();
    expect(stale?.status).toBe("cancelled");
    expect((await InventoryItem.findOne({ sku: bike.sku }).exec())?.reserved).toBe(1);
  });

  it("refuses an empty cart", async () => {
    stubStripe();
    const res = await request(app).post(ORDERS).set("Cookie", cookie).send({});
    expect(res.status).toBe(400);
  });

  it("refuses a cart whose product was archived while the customer browsed", async () => {
    stubStripe();
    await addToCart(app, cookie, { itemType: "bike", itemId: bike.itemId, sku: bike.sku });
    await bike.bike.updateOne({ isActive: false, archivedAt: new Date() });

    const res = await request(app).post(ORDERS).set("Cookie", cookie).send({});

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("BK-CO-M");
  });

  it("requires authentication", async () => {
    const res = await request(app).post(ORDERS).send({});
    expect(res.status).toBe(401);
  });
});
