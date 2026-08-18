import { Types } from "mongoose";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { Order } from "../src/models/index.js";
import { createAdminSession, createCustomerSession } from "./helpers/admin-session.js";
import { createInventoryItemDoc } from "./helpers/factories.js";

const ADMIN = "/api/v1/admin";

type App = ReturnType<typeof buildApp>;

const SHIPPING_ADDRESS = {
  recipientName: "Cliente de Prueba",
  phone: "5512345678",
  street: "Calle Falsa 123",
  neighborhood: "Centro",
  city: "Ciudad de México",
  state: "Ciudad de México",
  postalCode: "01000",
  country: "MX" as const,
};

/**
 * Seeds a minimal, valid order **directly against the model** — this file
 * tests the stats *readers*, not checkout itself (that rigor lives in
 * order-checkout.test.ts and friends, which walk the real Stripe flow).
 */
async function seedOrder(overrides: {
  status: string;
  createdAt: Date;
  totalCents?: number;
}): Promise<void> {
  const totalCents = overrides.totalCents ?? 10_000_00;
  const order = await Order.create({
    orderNumber: `BW-2026-${Math.random().toString(16).slice(2, 8).toUpperCase()}`,
    userId: new Types.ObjectId(),
    status: overrides.status,
    lines: [
      {
        itemType: "bike",
        itemId: String(new Types.ObjectId()),
        sku: "BK-STATS-M",
        name: "Bici de prueba",
        brand: "Specialized",
        fulfillmentMode: "in_stock",
        unitPriceCents: totalCents,
        qty: 1,
        lineTotalCents: totalCents,
      },
    ],
    subtotalCents: totalCents,
    taxCents: 0,
    totalCents,
    payment: { provider: "stripe", state: "pending", captureMethod: "automatic" },
    shippingAddress: SHIPPING_ADDRESS,
    statusHistory: [{ status: overrides.status, at: overrides.createdAt, actorType: "system" }],
  });

  // `timestamps: true` sets `createdAt` on insert — backdate it with the raw
  // driver afterward, the same technique order-authorization.test.ts uses,
  // since a normal `updateOne({$set:{createdAt}})` would be silently ignored
  // by Mongoose's timestamps plugin.
  await Order.collection.updateOne({ _id: order._id }, { $set: { createdAt: overrides.createdAt } });
}

describe("Admin stats", () => {
  it("rejects an anonymous caller with 401 and a customer with 403", async () => {
    const app: App = buildApp();
    const customerCookie = await createCustomerSession(app);

    const anon = await request(app).get(`${ADMIN}/stats/overview`);
    expect(anon.status).toBe(401);

    const customer = await request(app).get(`${ADMIN}/stats/overview`).set("Cookie", customerCookie);
    expect(customer.status).toBe(403);
  });

  it("resolves the date window once and hands the identical range to every module", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    const res = await request(app)
      .get(`${ADMIN}/stats/overview?preset=7d`)
      .set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    const overview = res.body.data.overview;

    expect(overview.range.preset).toBe("7d");
    // Byte-for-byte the same object on every module — not merely "close
    // enough" — which is exactly the property that stops two charts on one
    // panel from silently disagreeing about what "last 7 days" means.
    expect(overview.orders.range).toEqual(overview.range);
    expect(overview.inventory.range).toEqual(overview.range);
    expect(overview.applications.range).toEqual(overview.range);
    expect(overview.preferences.range).toEqual(overview.range);
  });

  it("keeps an operational alert visible even when the panel is filtered to today", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    // An order that has been stuck in the supplier queue for a month — well
    // outside any "today" window, but still an open item the admin has to
    // work through.
    const stuckSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await seedOrder({ status: "awaiting_supplier_confirmation", createdAt: stuckSince });

    const res = await request(app)
      .get(`${ADMIN}/stats/overview?preset=today`)
      .set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.overview.range.preset).toBe("today");
    // The alert is not windowed at all (see stats/alerts.stats.ts) — a
    // "today" filter on the rest of the panel must not make it disappear.
    expect(res.body.data.overview.alerts.awaitingSupplierConfirmation).toBe(1);
  });

  it("counts revenue only from orders inside the requested window", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    await seedOrder({ status: "paid", createdAt: new Date(), totalCents: 5_000_00 });
    // Outside any 7-day window — must not inflate the figure below.
    await seedOrder({
      status: "paid",
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      totalCents: 999_999_00,
    });
    // Cancelled orders never represent captured money.
    await seedOrder({ status: "cancelled", createdAt: new Date(), totalCents: 1_000_00 });

    const res = await request(app)
      .get(`${ADMIN}/stats/orders?preset=7d`)
      .set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.stats.revenueCents).toBe(5_000_00);
  });

  it("rejects a custom range with from after to", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    const res = await request(app)
      .get(`${ADMIN}/stats/orders?preset=custom&from=2026-08-10&to=2026-08-01`)
      .set("Cookie", adminCookie);

    expect(res.status).toBe(400);
  });
});

describe("Admin stats — inventory.lowStockSkus reads Settings, not a constant", () => {
  it("moves when the store-wide threshold is edited, without touching the row itself", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    // 8 available units: healthy under the original default (5), low once the
    // threshold is raised to 10 — same row, same data, different Settings.
    await createInventoryItemDoc({ sku: "BK-STATS-LOW", onHand: 8, reserved: 0 });

    const before = await request(app).get(`${ADMIN}/stats/inventory`).set("Cookie", adminCookie);
    expect(before.body.data.stats.lowStockSkus).toBe(0);

    await request(app)
      .put(`${ADMIN}/settings/inventory`)
      .set("Cookie", adminCookie)
      .send({ stockReservationTtlMinutes: 30, reservationRetentionDays: 30, lowStockThresholdUnits: 10 });

    const after = await request(app).get(`${ADMIN}/stats/inventory`).set("Cookie", adminCookie);
    expect(after.body.data.stats.lowStockSkus).toBe(1);
  });
});
