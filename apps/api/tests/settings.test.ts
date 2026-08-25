import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { AuditLog, Settings } from "../src/models/index.js";
import { createAdminSession, createCustomerSession } from "./helpers/admin-session.js";

const ADMIN = "/api/v1/admin";

type App = ReturnType<typeof buildApp>;

describe("Settings — singleton editable by section", () => {
  it("GET returns the lazily-created document with its documented defaults", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    const res = await request(app).get(`${ADMIN}/settings`).set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.settings).toMatchObject({
      inventory: { stockReservationTtlMinutes: 30, reservationRetentionDays: 30, lowStockThresholdUnits: 5 },
      orders: {
        orderPaymentTtlMinutes: 15,
        orderAuthAlertHours: 120,
        orderAuthCancelHours: 156,
        paymentReconciliationAfterMinutes: 20,
        requestThreeDSecure: "automatic",
      },
      pricing: { taxRateBps: 1600 },
      shipping: { accessoryFlatCents: 25_000, freeShippingThresholdCents: 200_000 },
      applications: { cooldownDays: 90 },
      jobs: {
        reservationReaperIntervalMs: 60_000,
        orderAuthSweepIntervalMs: 300_000,
        paymentReconciliationIntervalMs: 600_000,
        lowStockAlertIntervalMs: 300_000,
      },
    });

    const stored = await Settings.findOne({ key: "global" }).exec();
    expect(stored).not.toBeNull();
  });

  it("self-heals orders.requestThreeDSecure on read for a singleton that predates the field (Sesión 3 audit)", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    // Bypasses Mongoose entirely to write the shape a pre-M9 singleton
    // actually has in production/dev — Mongoose's own `default` would mask
    // the bug this test guards against if the raw driver weren't used here.
    await Settings.collection.insertOne({
      key: "global",
      inventory: { stockReservationTtlMinutes: 30, reservationRetentionDays: 30, lowStockThresholdUnits: 5 },
      orders: {
        orderPaymentTtlMinutes: 15,
        orderAuthAlertHours: 120,
        orderAuthCancelHours: 156,
        paymentReconciliationAfterMinutes: 20,
        // requestThreeDSecure intentionally absent.
      },
      pricing: { taxRateBps: 1600 },
      shipping: { accessoryFlatCents: 25_000, freeShippingThresholdCents: 200_000 },
      applications: { cooldownDays: 90 },
      jobs: {
        reservationReaperIntervalMs: 60_000,
        orderAuthSweepIntervalMs: 300_000,
        paymentReconciliationIntervalMs: 600_000,
        lowStockAlertIntervalMs: 300_000,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app).get(`${ADMIN}/settings`).set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.settings.orders.requestThreeDSecure).toBe("automatic");
  });

  it("rejects an anonymous caller with 401 and a customer with 403", async () => {
    const app: App = buildApp();
    const customerCookie = await createCustomerSession(app);

    const anon = await request(app).get(`${ADMIN}/settings`);
    expect(anon.status).toBe(401);

    const customer = await request(app).get(`${ADMIN}/settings`).set("Cookie", customerCookie);
    expect(customer.status).toBe(403);
  });

  it("editing one section never touches another — even when two admins write concurrently", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    // Prime the document with its defaults before racing two section writes,
    // so the assertion below isn't also proving the lazy-create path.
    await request(app).get(`${ADMIN}/settings`).set("Cookie", adminCookie);

    const [shippingRes, ordersRes] = await Promise.all([
      request(app)
        .put(`${ADMIN}/settings/shipping`)
        .set("Cookie", adminCookie)
        .send({ accessoryFlatCents: 30_000, freeShippingThresholdCents: 250_000 }),
      request(app)
        .put(`${ADMIN}/settings/orders`)
        .set("Cookie", adminCookie)
        .send({
          orderPaymentTtlMinutes: 20,
          orderAuthAlertHours: 100,
          orderAuthCancelHours: 140,
          paymentReconciliationAfterMinutes: 25,
          requestThreeDSecure: "automatic",
        }),
    ]);

    expect(shippingRes.status).toBe(200);
    expect(ordersRes.status).toBe(200);

    // Re-read straight from the database — not from either response body —
    // so this proves what actually landed, not what the API merely echoed.
    const stored = await Settings.findOne({ key: "global" }).exec();
    expect(stored?.shipping).toMatchObject({ accessoryFlatCents: 30_000, freeShippingThresholdCents: 250_000 });
    expect(stored?.orders).toMatchObject({
      orderPaymentTtlMinutes: 20,
      orderAuthAlertHours: 100,
      orderAuthCancelHours: 140,
      paymentReconciliationAfterMinutes: 25,
      requestThreeDSecure: "automatic",
    });
    // Untouched sections kept their defaults — the two concurrent writes did
    // not clobber anything outside the section each one targeted.
    expect(stored?.pricing).toMatchObject({ taxRateBps: 1600 });
    expect(stored?.inventory).toMatchObject({ stockReservationTtlMinutes: 30, reservationRetentionDays: 30 });
  });

  it("strips a field from another section instead of letting it leak into the write", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    const res = await request(app)
      .put(`${ADMIN}/settings/shipping`)
      .set("Cookie", adminCookie)
      .send({ accessoryFlatCents: 10_000, freeShippingThresholdCents: 100_000, taxRateBps: 999 });

    expect(res.status).toBe(200);

    const stored = await Settings.findOne({ key: "global" }).exec();
    expect(stored?.shipping).toMatchObject({ accessoryFlatCents: 10_000, freeShippingThresholdCents: 100_000 });
    // The smuggled `taxRateBps` never reached the pricing section it doesn't belong to.
    expect(stored?.pricing.taxRateBps).toBe(1600);
  });

  it("records one audit entry per section write, with before/after scoped to that section", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    await request(app)
      .put(`${ADMIN}/settings/pricing`)
      .set("Cookie", adminCookie)
      .send({ taxRateBps: 800 });

    const entry = await AuditLog.findOne({ action: "settings.pricing_updated" }).exec();
    expect(entry).not.toBeNull();
    expect(entry?.module).toBe("settings");
    expect(entry?.after).toMatchObject({ taxRateBps: 800 });
  });

  it("rejects an orders write with an invalid 3D Secure policy", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    const res = await request(app)
      .put(`${ADMIN}/settings/orders`)
      .set("Cookie", adminCookie)
      .send({
        orderPaymentTtlMinutes: 15,
        orderAuthAlertHours: 120,
        orderAuthCancelHours: 156,
        paymentReconciliationAfterMinutes: 20,
        requestThreeDSecure: "always", // not a value Stripe's request_three_d_secure accepts
      });

    expect(res.status).toBe(400);

    const stored = await Settings.findOne({ key: "global" }).exec();
    expect(stored?.orders.requestThreeDSecure ?? "automatic").toBe("automatic");
  });

  it("lets the admin tighten the 3D Secure policy to 'any' for every future checkout", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    const res = await request(app)
      .put(`${ADMIN}/settings/orders`)
      .set("Cookie", adminCookie)
      .send({
        orderPaymentTtlMinutes: 15,
        orderAuthAlertHours: 120,
        orderAuthCancelHours: 156,
        paymentReconciliationAfterMinutes: 20,
        requestThreeDSecure: "any",
      });

    expect(res.status).toBe(200);
    const stored = await Settings.findOne({ key: "global" }).exec();
    expect(stored?.orders.requestThreeDSecure).toBe("any");
  });

  it("rejects an orders write where the alert threshold isn't lower than the cancel threshold", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    const res = await request(app)
      .put(`${ADMIN}/settings/orders`)
      .set("Cookie", adminCookie)
      .send({
        orderPaymentTtlMinutes: 15,
        orderAuthAlertHours: 160,
        orderAuthCancelHours: 156,
        paymentReconciliationAfterMinutes: 20,
        requestThreeDSecure: "automatic",
      });

    expect(res.status).toBe(400);

    const stored = await Settings.findOne({ key: "global" }).exec();
    // Still the default — the invalid write never landed.
    expect(stored?.orders.orderAuthAlertHours ?? 120).toBe(120);
  });

  it("requires lowStockThresholdUnits on an inventory write — the field the stats module used to hardcode", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    const missing = await request(app)
      .put(`${ADMIN}/settings/inventory`)
      .set("Cookie", adminCookie)
      .send({ stockReservationTtlMinutes: 30, reservationRetentionDays: 30 });
    expect(missing.status).toBe(400);

    const ok = await request(app)
      .put(`${ADMIN}/settings/inventory`)
      .set("Cookie", adminCookie)
      .send({ stockReservationTtlMinutes: 45, reservationRetentionDays: 30, lowStockThresholdUnits: 8 });

    expect(ok.status).toBe(200);
    const stored = await Settings.findOne({ key: "global" }).exec();
    expect(stored?.inventory).toMatchObject({
      stockReservationTtlMinutes: 45,
      reservationRetentionDays: 30,
      lowStockThresholdUnits: 8,
    });
    // The section-scoped write didn't touch anything outside `inventory`.
    expect(stored?.pricing).toMatchObject({ taxRateBps: 1600 });
  });
});
