import { Types } from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { AuditLog, Order } from "../src/models/index.js";
import { createAdminSession, createCustomerSession } from "./helpers/admin-session.js";
import { createInventoryItemDoc, seedBikeWithVariant } from "./helpers/factories.js";
import { setShippingAddress } from "./helpers/shipping.js";
import { paymentIntentObject, signStripeEvent, stubStripe } from "./helpers/stripe.js";

/**
 * M11.5 — the order fields the queue was missing: priority, staff notes, the
 * unwindowed KPI summary, the readable activity log, and the card-on-file
 * that rides along the existing checkout/webhook flow. Reuses
 * `order-fulfillment.test.ts`'s checkout/paidOrder shape rather than
 * reinventing it.
 */

const CART = "/api/v1/cart";
const ORDERS = "/api/v1/orders";
const ADMIN = "/api/v1/admin";
const WEBHOOK = "/api/v1/webhooks/stripe";

type App = ReturnType<typeof buildApp>;

describe("order triage — priority, notes, summary, activity, card (M11.5)", () => {
  let app: App;
  let cookie: string;
  let adminCookie: string;
  let stripe: ReturnType<typeof stubStripe>;
  let bike: Awaited<ReturnType<typeof seedBikeWithVariant>>;

  beforeEach(async () => {
    app = buildApp();
    cookie = await createCustomerSession(app, "triage-buyer@example.com");
    await setShippingAddress(app, cookie);
    adminCookie = await createAdminSession(app);
    stripe = stubStripe();
    bike = await seedBikeWithVariant({ sku: "BK-TRI-M", price: 19_999_900 });
    await createInventoryItemDoc({ itemId: new Types.ObjectId(bike.itemId), sku: bike.sku, onHand: 5 });
  });

  async function checkout(): Promise<{ orderId: string; intentId: string }> {
    await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 });
    const res = await request(app).post(ORDERS).set("Cookie", cookie).send({});
    expect(res.status).toBe(201);
    return { orderId: res.body.data.order.id as string, intentId: stripe.lastIntentId() };
  }

  /** Walks the order to `paid` through the real webhook — an in-stock cart captures immediately. */
  async function paidOrder(): Promise<string> {
    const { orderId, intentId } = await checkout();
    const { body, signature } = signStripeEvent({
      type: "payment_intent.succeeded",
      object: paymentIntentObject({ id: intentId, orderId }),
    });
    await request(app).post(WEBHOOK).set("stripe-signature", signature).type("application/json").send(body);
    return orderId;
  }

  describe("PATCH /admin/orders/:id/priority", () => {
    it("defaults new orders to normal, and updates + audits a change", async () => {
      const { orderId } = await checkout();
      const before = await request(app).get(`${ADMIN}/orders/${orderId}`).set("Cookie", adminCookie);
      expect(before.body.data.order.priority).toBe("normal");

      const res = await request(app)
        .patch(`${ADMIN}/orders/${orderId}/priority`)
        .set("Cookie", adminCookie)
        .send({ priority: "urgente" });

      expect(res.status).toBe(200);
      expect(res.body.data.order.priority).toBe("urgente");
      expect(await AuditLog.findOne({ action: "order.priority_updated", targetId: orderId }).exec()).not.toBeNull();
    });

    it("rejects a priority outside the closed list", async () => {
      const { orderId } = await checkout();
      const res = await request(app)
        .patch(`${ADMIN}/orders/${orderId}/priority`)
        .set("Cookie", adminCookie)
        .send({ priority: "asap" });

      expect(res.status).toBe(400);
    });

    it("refuses a customer and an anonymous caller", async () => {
      const { orderId } = await checkout();

      const asCustomer = await request(app)
        .patch(`${ADMIN}/orders/${orderId}/priority`)
        .set("Cookie", cookie)
        .send({ priority: "alta" });
      const anonymous = await request(app).patch(`${ADMIN}/orders/${orderId}/priority`).send({ priority: "alta" });

      expect(asCustomer.status).toBe(403);
      expect(anonymous.status).toBe(401);
    });
  });

  describe("POST /admin/orders/:id/notes", () => {
    it("appends a note with the acting admin's frozen name, and audits it without duplicating the body", async () => {
      const { orderId } = await checkout();

      const res = await request(app)
        .post(`${ADMIN}/orders/${orderId}/notes`)
        .set("Cookie", adminCookie)
        .send({ body: "Cliente llamó molesto por retraso." });

      expect(res.status).toBe(201);
      expect(res.body.data.note).toMatchObject({ body: "Cliente llamó molesto por retraso." });
      expect(res.body.data.note.authorName).toBeTruthy();

      const detail = await request(app).get(`${ADMIN}/orders/${orderId}`).set("Cookie", adminCookie);
      expect(detail.body.data.order.internalNotes).toHaveLength(1);

      const auditEntry = await AuditLog.findOne({ action: "order.note_added", targetId: orderId }).exec();
      expect(auditEntry).not.toBeNull();
      expect(auditEntry?.after).toBeUndefined();
    });

    it("never appears on the customer's own view of the order", async () => {
      const { orderId } = await checkout();
      await request(app)
        .post(`${ADMIN}/orders/${orderId}/notes`)
        .set("Cookie", adminCookie)
        .send({ body: "Nota interna, no para el cliente." });

      const res = await request(app).get(`${ORDERS}/${orderId}`).set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.order.internalNotes).toBeUndefined();
    });

    it("rejects an empty body and a body over the length limit", async () => {
      const { orderId } = await checkout();

      const empty = await request(app).post(`${ADMIN}/orders/${orderId}/notes`).set("Cookie", adminCookie).send({ body: "" });
      const tooLong = await request(app)
        .post(`${ADMIN}/orders/${orderId}/notes`)
        .set("Cookie", adminCookie)
        .send({ body: "x".repeat(1001) });

      expect(empty.status).toBe(400);
      expect(tooLong.status).toBe(400);
    });

    it("refuses a 51st note once the order is at the cap", async () => {
      const { orderId } = await checkout();
      const order = await Order.findById(orderId).exec();
      order!.internalNotes = Array.from({ length: 50 }, (_, i) => ({
        body: `Nota ${i}`,
        authorId: new Types.ObjectId(),
        authorName: "Admin Seed",
        createdAt: new Date(),
      }));
      await order!.save();

      const res = await request(app)
        .post(`${ADMIN}/orders/${orderId}/notes`)
        .set("Cookie", adminCookie)
        .send({ body: "La que ya no cabe." });

      expect(res.status).toBe(409);
    });
  });

  describe("GET /admin/orders/summary", () => {
    it("counts by status, disputed, and expiring authorizations, unwindowed by date", async () => {
      const first = await paidOrder();
      await checkout(); // stays pending_payment

      const summary = await request(app).get(`${ADMIN}/orders/summary`).set("Cookie", adminCookie);

      expect(summary.status).toBe(200);
      expect(summary.body.data.summary.countsByStatus.paid).toBe(1);
      expect(summary.body.data.summary.countsByStatus.pending_payment).toBe(1);
      expect(summary.body.data.summary.disputed).toBe(0);

      await Order.updateOne({ _id: first }, { $set: { disputedAt: new Date() } }).exec();
      const afterDispute = await request(app).get(`${ADMIN}/orders/summary`).set("Cookie", adminCookie);
      expect(afterDispute.body.data.summary.disputed).toBe(1);
    });

    it("refuses a customer and an anonymous caller", async () => {
      const asCustomer = await request(app).get(`${ADMIN}/orders/summary`).set("Cookie", cookie);
      const anonymous = await request(app).get(`${ADMIN}/orders/summary`);

      expect(asCustomer.status).toBe(403);
      expect(anonymous.status).toBe(401);
    });
  });

  describe("GET /admin/orders/:id/activity", () => {
    it("returns who-did-what-when, never the before/after payload", async () => {
      const orderId = await paidOrder();
      await request(app)
        .patch(`${ADMIN}/orders/${orderId}/priority`)
        .set("Cookie", adminCookie)
        .send({ priority: "alta" });

      const res = await request(app).get(`${ADMIN}/orders/${orderId}/activity`).set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.activity.length).toBeGreaterThanOrEqual(2);
      const actions = res.body.data.activity.map((e: { action: string }) => e.action);
      expect(actions).toContain("order.priority_updated");
      for (const entry of res.body.data.activity) {
        expect(entry).not.toHaveProperty("before");
        expect(entry).not.toHaveProperty("after");
        expect(entry.createdAt).toBeTruthy();
        expect(entry.actorType).toBeTruthy();
      }
    });

    it("404s for an order that doesn't exist", async () => {
      const res = await request(app)
        .get(`${ADMIN}/orders/${new Types.ObjectId().toString()}/activity`)
        .set("Cookie", adminCookie);
      expect(res.status).toBe(404);
    });
  });

  describe("card on file", () => {
    it("records brand/last4 on an automatically-captured order via the webhook", async () => {
      stripe.setCard({ brand: "visa", last4: "4242" });
      const orderId = await paidOrder();

      const res = await request(app).get(`${ADMIN}/orders/${orderId}`).set("Cookie", adminCookie);

      expect(res.body.data.order.payment.card).toEqual({ brand: "visa", last4: "4242" });
    });
  });
});
