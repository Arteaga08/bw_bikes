import { Types } from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { Order } from "../src/models/index.js";
import { createAdminSession, createCustomerSession } from "./helpers/admin-session.js";
import { createInventoryItemDoc, seedBikeWithVariant } from "./helpers/factories.js";
import { setShippingAddress } from "./helpers/shipping.js";
import { stubStripe } from "./helpers/stripe.js";

const CART = "/api/v1/cart";
const ORDERS = "/api/v1/orders";
const ADMIN = "/api/v1/admin";

type App = ReturnType<typeof buildApp>;

describe("order security", () => {
  let app: App;
  let alice: string;
  let bob: string;
  let bike: Awaited<ReturnType<typeof seedBikeWithVariant>>;

  beforeEach(async () => {
    app = buildApp();
    alice = await createCustomerSession(app, "alice@example.com");
    bob = await createCustomerSession(app, "bob@example.com");
    await setShippingAddress(app, alice);
    await setShippingAddress(app, bob);
    stubStripe();
    bike = await seedBikeWithVariant({ sku: "BK-SEC-M", price: 19_999_900 });
    await createInventoryItemDoc({ itemId: new Types.ObjectId(bike.itemId), sku: bike.sku, onHand: 10 });
  });

  async function placeOrder(cookie: string): Promise<string> {
    await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 });
    const res = await request(app).post(ORDERS).set("Cookie", cookie).send({});
    expect(res.status).toBe(201);
    return res.body.data.order.id as string;
  }

  describe("anti-IDOR", () => {
    it("never hands one customer another customer's order", async () => {
      const bobsOrder = await placeOrder(bob);

      const res = await request(app).get(`${ORDERS}/${bobsOrder}`).set("Cookie", alice);

      expect(res.status).toBe(404);
      expect(res.body.data).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain("BW-");
    });

    it("answers 404 and not 403, so an id cannot be probed for existence", async () => {
      const bobsOrder = await placeOrder(bob);
      const nonExistent = new Types.ObjectId().toString();

      const real = await request(app).get(`${ORDERS}/${bobsOrder}`).set("Cookie", alice);
      const fake = await request(app).get(`${ORDERS}/${nonExistent}`).set("Cookie", alice);

      // Byte-for-byte identical: a real order belonging to someone else must be
      // indistinguishable from one that was never created.
      expect(real.status).toBe(fake.status);
      expect(real.body).toEqual(fake.body);
    });

    it("lists only the caller's own orders", async () => {
      await placeOrder(bob);
      const alicesOrder = await placeOrder(alice);

      const res = await request(app).get(ORDERS).set("Cookie", alice);

      expect(res.body.data.orders).toHaveLength(1);
      expect(res.body.data.orders[0].id).toBe(alicesOrder);
      expect(res.body.meta.total).toBe(1);
      // Two orders exist; Alice can see one.
      expect(await Order.countDocuments()).toBe(2);
    });

    it("does not let a malformed id turn into a cast error", async () => {
      const res = await request(app).get(`${ORDERS}/not-an-object-id`).set("Cookie", alice);
      expect(res.status).toBe(400);
    });

    it("keeps the gateway payment id off the customer's own order", async () => {
      const orderId = await placeOrder(alice);

      const res = await request(app).get(`${ORDERS}/${orderId}`).set("Cookie", alice);

      expect(res.status).toBe(200);
      expect(res.body.data.order.payment.state).toBeTruthy();
      expect(res.body.data.order.payment.intentId).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain("pi_test");
    });
  });

  describe("admin surface", () => {
    it("refuses a logged-in customer with 403, not 404", async () => {
      const orderId = await placeOrder(alice);

      for (const path of [
        `${ADMIN}/orders`,
        `${ADMIN}/orders/${orderId}`,
      ]) {
        const res = await request(app).get(path).set("Cookie", alice);
        expect(res.status).toBe(403);
      }
    });

    it("refuses a customer trying to confirm or reject supplier stock", async () => {
      const orderId = await placeOrder(alice);

      const confirm = await request(app)
        .post(`${ADMIN}/orders/${orderId}/confirm-supplier-stock`)
        .set("Cookie", alice)
        .send({});
      const reject = await request(app)
        .post(`${ADMIN}/orders/${orderId}/reject-supplier-stock`)
        .set("Cookie", alice)
        .send({ reason: "porque sí" });

      expect(confirm.status).toBe(403);
      expect(reject.status).toBe(403);
    });

    it("refuses an anonymous caller with 401", async () => {
      const res = await request(app).get(`${ADMIN}/orders`);
      expect(res.status).toBe(401);
    });

    it("lets an admin see any order, with the buyer and the gateway id", async () => {
      const orderId = await placeOrder(alice);
      const adminCookie = await createAdminSession(app);

      const res = await request(app).get(`${ADMIN}/orders/${orderId}`).set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.order.customer.email).toBe("alice@example.com");
      expect(res.body.data.order.paymentIntentId).toBeTruthy();
    });
  });

  describe("input handling", () => {
    it("ignores a Mongo operator smuggled into a list filter", async () => {
      await placeOrder(bob);
      await placeOrder(alice);

      // `?status[$ne]=nothing` would return every order if the query object
      // ever reached the filter.
      const res = await request(app).get(`${ORDERS}?status[$ne]=nothing`).set("Cookie", alice);

      expect(res.status).toBe(200);
      expect(res.body.data.orders).toHaveLength(1);
    });

    it("refuses to sort by a field that is not whitelisted", async () => {
      const res = await request(app).get(`${ORDERS}?sort=payment.intentId`).set("Cookie", alice);
      expect(res.status).toBe(400);
    });
  });

  describe("checkout rate limiting", () => {
    it("cuts off a burst of checkout attempts", async () => {
      // Every call would otherwise mint a payment intent and hold inventory —
      // exactly what a stolen-card script wants.
      const statuses: number[] = [];
      for (let i = 0; i < 12; i++) {
        const res = await request(app).post(ORDERS).set("Cookie", alice).send({});
        statuses.push(res.status);
      }

      expect(statuses.filter((status) => status === 429).length).toBeGreaterThan(0);
      expect(statuses.slice(0, 10).every((status) => status !== 429)).toBe(true);
    });

    it("does not throttle simply browsing one's own orders", async () => {
      for (let i = 0; i < 15; i++) {
        const res = await request(app).get(ORDERS).set("Cookie", alice);
        expect(res.status).toBe(200);
      }
    });
  });
});
