import { Types } from "mongoose";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

/**
 * The state every environment is in until real Stripe credentials are wired
 * up — which, for this project, is most of the backend phase.
 *
 * The rule being pinned here is that payments degrade to a **refusal**, never
 * to a pretend success. Every other integration in the codebase has a harmless
 * fallback (the mailer logs, uploads 503). A payment stub cannot be harmless:
 * an order marked paid by a fake gateway is indistinguishable from a real sale
 * until somebody goes looking for the money.
 *
 * `env` is frozen, so the module is replaced rather than spied on — and that is
 * why this lives in its own file, since a module mock applies file-wide.
 */
vi.mock("../src/config/env.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/config/env.js")>();
  return { ...actual, env: { ...actual.env, isStripeConfigured: false } };
});

const { buildApp } = await import("../src/app.js");
const { Order } = await import("../src/models/index.js");
const { createCustomerSession } = await import("./helpers/admin-session.js");
const { createInventoryItemDoc, seedBikeWithVariant } = await import("./helpers/factories.js");

describe("Stripe not configured", () => {
  it("still serves the rest of the API", async () => {
    const app = buildApp();

    const health = await request(app).get("/api/v1/health");
    const catalog = await request(app).get("/api/v1/catalog/bikes");

    expect(health.status).toBe(200);
    expect(catalog.status).toBe(200);
  });

  it("still lets a customer build a cart", async () => {
    const app = buildApp();
    const cookie = await createCustomerSession(app, "browsing@example.com");
    const bike = await seedBikeWithVariant({ sku: "BK-NOCFG-M" });
    await createInventoryItemDoc({ itemId: new Types.ObjectId(bike.itemId), sku: bike.sku, onHand: 2 });

    const res = await request(app)
      .post("/api/v1/cart/lines")
      .set("Cookie", cookie)
      .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 });

    expect(res.status).toBe(201);
  });

  it("refuses checkout with an explicit 503, creating no order and holding no stock", async () => {
    const app = buildApp();
    const cookie = await createCustomerSession(app, "blocked-buyer@example.com");
    const bike = await seedBikeWithVariant({ sku: "BK-NOCFG-L" });
    await createInventoryItemDoc({ itemId: new Types.ObjectId(bike.itemId), sku: bike.sku, onHand: 2 });

    await request(app)
      .post("/api/v1/cart/lines")
      .set("Cookie", cookie)
      .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 });

    const res = await request(app)
      .post("/api/v1/orders")
      .set("Cookie", cookie)
      .send({ termsAcceptedAt: new Date().toISOString() });

    expect(res.status).toBe(503);
    expect(res.body.message).toContain("pagos no están configurados");
    // The refusal happens before anything is written or held.
    expect(await Order.countDocuments()).toBe(0);
  });

  it("refuses the webhook rather than accepting unverifiable events", async () => {
    const app = buildApp();

    const res = await request(app)
      .post("/api/v1/webhooks/stripe")
      .set("stripe-signature", "t=1,v1=whatever")
      .type("application/json")
      .send(JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded" }));

    expect(res.status).toBe(503);
  });
});
