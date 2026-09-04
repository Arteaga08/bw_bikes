import { Types } from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createAdminSession, createCustomerSession } from "./helpers/admin-session.js";
import { createInventoryItemDoc, seedBikeWithVariant } from "./helpers/factories.js";
import { setShippingAddress } from "./helpers/shipping.js";
import { paymentIntentObject, signStripeEvent, stubStripe } from "./helpers/stripe.js";

/**
 * `GET /admin/orders` — the admin órdenes redesign's two new list filters:
 * `status` as a comma-separated list (the grouped filter chips /
 * `OrdersSummaryCards`'s tiles need, since a single order status can't
 * express "paid or processing") and `search` (name/phone/email — the backend
 * accepted-and-ignored `search` `parseListQuery` already parsed, now actually
 * read by `listForAdmin`). Reuses `order-triage.test.ts`'s checkout/paidOrder
 * shape rather than reinventing it.
 */

const CART = "/api/v1/cart";
const ORDERS = "/api/v1/orders";
const ADMIN = "/api/v1/admin";
const WEBHOOK = "/api/v1/webhooks/stripe";

type App = ReturnType<typeof buildApp>;

describe("GET /admin/orders — multi-status and search", () => {
  let app: App;
  let adminCookie: string;
  let stripe: ReturnType<typeof stubStripe>;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    stripe = stubStripe();
  });

  /** Checks out one order for a fresh customer, with a distinguishable shipping name. */
  async function orderFor(
    email: string,
    overrides: { firstName?: string; lastName?: string } = {},
  ): Promise<{ orderId: string; intentId: string }> {
    const cookie = await createCustomerSession(app, email);
    const bike = await seedBikeWithVariant({ sku: `BK-${Math.random().toString(16).slice(2, 8).toUpperCase()}`, price: 9_999_00 });
    await createInventoryItemDoc({ itemId: new Types.ObjectId(bike.itemId), sku: bike.sku, onHand: 5 });
    await setShippingAddress(app, cookie, overrides);
    await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 });
    const res = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });
    expect(res.status).toBe(201);
    return { orderId: res.body.data.order.id as string, intentId: stripe.lastIntentId() };
  }

  async function markPaid(orderId: string, intentId: string): Promise<void> {
    const { body, signature } = signStripeEvent({
      type: "payment_intent.succeeded",
      object: paymentIntentObject({ id: intentId, orderId }),
    });
    const res = await request(app).post(WEBHOOK).set("stripe-signature", signature).type("application/json").send(body);
    expect(res.status).toBe(200);
  }

  async function markProcessing(orderId: string): Promise<void> {
    const res = await request(app)
      .patch(`${ADMIN}/orders/bulk-status`)
      .set("Cookie", adminCookie)
      .send({ orderIds: [orderId], status: "processing" });
    expect(res.status).toBe(200);
  }

  describe("status as a comma-separated list", () => {
    it("returns the union of the listed statuses", async () => {
      const { orderId: paidId, intentId } = await orderFor("multi-status-a@example.com");
      await markPaid(paidId, intentId);

      const { orderId: processingId, intentId: intentId2 } = await orderFor("multi-status-b@example.com");
      await markPaid(processingId, intentId2);
      await markProcessing(processingId);

      // A third order stays `authorized` — must not appear.
      await orderFor("multi-status-c@example.com");

      const res = await request(app)
        .get(`${ADMIN}/orders`)
        .query({ status: "paid,processing" })
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      const ids = (res.body.data.orders as Array<{ id: string }>).map((o) => o.id);
      expect(ids).toEqual(expect.arrayContaining([paidId, processingId]));
      expect(ids).not.toContain(undefined);
      for (const order of res.body.data.orders as Array<{ status: string }>) {
        expect(["paid", "processing"]).toContain(order.status);
      }
    });

    it("still accepts a single status value unchanged", async () => {
      const { orderId, intentId } = await orderFor("single-status@example.com");
      await markPaid(orderId, intentId);

      const res = await request(app).get(`${ADMIN}/orders`).query({ status: "paid" }).set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect((res.body.data.orders as Array<{ id: string }>).map((o) => o.id)).toContain(orderId);
    });

    it("rejects a list containing a value outside the closed status set", async () => {
      const res = await request(app)
        .get(`${ADMIN}/orders`)
        .query({ status: "paid,not_a_real_status" })
        .set("Cookie", adminCookie);

      expect(res.status).toBe(400);
    });
  });

  describe("search", () => {
    it("matches by the shipping address's last name", async () => {
      const { orderId } = await orderFor("search-lastname@example.com", { lastName: "Zapata-Reyes" });

      const res = await request(app).get(`${ADMIN}/orders`).query({ search: "zapata-reyes" }).set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect((res.body.data.orders as Array<{ id: string }>).map((o) => o.id)).toContain(orderId);
    });

    it("matches by the customer's account email", async () => {
      const { orderId } = await orderFor("findme-by-email@example.com");

      const res = await request(app)
        .get(`${ADMIN}/orders`)
        .query({ search: "findme-by-email" })
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect((res.body.data.orders as Array<{ id: string }>).map((o) => o.id)).toContain(orderId);
    });

    it("matches by order number prefix, case-insensitively", async () => {
      const { orderId } = await orderFor("search-orderno@example.com");
      const orderRes = await request(app).get(`${ADMIN}/orders/${orderId}`).set("Cookie", adminCookie);
      const orderNumber = orderRes.body.data.order.orderNumber as string;

      const res = await request(app)
        .get(`${ADMIN}/orders`)
        .query({ search: orderNumber.slice(0, 6).toLowerCase() })
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect((res.body.data.orders as Array<{ id: string }>).map((o) => o.id)).toContain(orderId);
    });

    it("treats regex metacharacters as literal text instead of erroring or over-matching", async () => {
      await orderFor("search-regex-safety@example.com", { lastName: "O'Neil" });

      const maliciousTerms = ["a.*b", "(((", "(a+)+$", ".*"];
      for (const term of maliciousTerms) {
        const res = await request(app).get(`${ADMIN}/orders`).query({ search: term }).set("Cookie", adminCookie);
        expect(res.status).toBe(200);
        // A literal match, not a wildcard: none of these crafted terms is a
        // real substring of any seeded name/email/order number, so the
        // (small, per-test) collection comes back empty rather than "everything".
        expect((res.body.data.orders as unknown[]).length).toBe(0);
      }
    });
  });

  it("refuses a non-admin caller regardless of filters", async () => {
    const customerCookie = await createCustomerSession(app, "not-an-admin@example.com");
    const res = await request(app).get(`${ADMIN}/orders`).query({ status: "paid,processing" }).set("Cookie", customerCookie);
    expect(res.status).toBe(403);
  });
});
