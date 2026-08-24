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

  it("counts a paid order not yet moved to processing as a newOrders alert", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    await seedOrder({ status: "paid", createdAt: new Date() });
    // A `processing` order is already being worked — it must not count as "new".
    await seedOrder({ status: "processing", createdAt: new Date() });

    const res = await request(app)
      .get(`${ADMIN}/stats/overview?preset=today`)
      .set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.overview.alerts.newOrders).toBe(1);
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

  it("buckets ordersByDay's revenue to REVENUE_STATUSES while the count includes every status that day", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    // Same `createdAt` on both, so they land in the same daily bucket
    // regardless of which timezone the boundary falls in.
    const sameInstant = new Date();
    await seedOrder({ status: "paid", createdAt: sameInstant, totalCents: 5_000_00 });
    await seedOrder({ status: "cancelled", createdAt: sameInstant, totalCents: 1_000_00 });

    const res = await request(app).get(`${ADMIN}/stats/orders?preset=today`).set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    const { ordersByDay } = res.body.data.stats;
    expect(ordersByDay).toHaveLength(1);
    // Both orders count toward the day's order volume...
    expect(ordersByDay[0].count).toBe(2);
    // ...but only the paid one is money the shop actually took in.
    expect(ordersByDay[0].revenueCents).toBe(5_000_00);
  });

  it("groups a daily bucket by the store's Mexico City calendar day, not UTC", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    // 02:00 UTC on the 18th is 20:00 on the 17th in America/Mexico_City
    // (UTC-6, no DST). Ungrouped ($dateToString without `timezone`) this
    // lands in the "2026-08-18" bucket; grouped by store time it belongs to
    // "2026-08-17" — exactly the ~6h discrepancy this fix closes.
    await seedOrder({ status: "paid", createdAt: new Date("2026-08-18T02:00:00.000Z"), totalCents: 1_000_00 });

    const res = await request(app)
      .get(`${ADMIN}/stats/orders?preset=custom&from=2026-08-16T00:00:00.000Z&to=2026-08-19T00:00:00.000Z`)
      .set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    const { ordersByDay } = res.body.data.stats;
    // Zero-filled across the whole window (store-time days 2026-08-15/16/17
    // for this UTC range) — the order itself only lands on the last one.
    expect(ordersByDay).toHaveLength(3);
    expect(ordersByDay.map((point: { date: string }) => point.date)).toEqual([
      "2026-08-15",
      "2026-08-16",
      "2026-08-17",
    ]);
    expect(ordersByDay[0].revenueCents).toBe(0);
    expect(ordersByDay[1].revenueCents).toBe(0);
    expect(ordersByDay[2].revenueCents).toBe(1_000_00);
  });

  it("reports previous: null when the preceding equivalent window has no orders at all", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    // Only inside the current 7-day window — nothing in the 7 days before it.
    await seedOrder({ status: "paid", createdAt: new Date(), totalCents: 5_000_00 });

    const res = await request(app).get(`${ADMIN}/stats/orders?preset=7d`).set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.stats.previous).toBeNull();
  });

  it("computes previous from the equivalent window immediately before the requested one", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    await seedOrder({ status: "paid", createdAt: new Date(), totalCents: 5_000_00 });
    // 10 days ago — inside the "previous 7 days" window for a `preset=7d`
    // request (days 7-14 back), outside the current one.
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    await seedOrder({ status: "paid", createdAt: tenDaysAgo, totalCents: 2_000_00 });
    // Even further back — outside both windows, must not leak in.
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    await seedOrder({ status: "paid", createdAt: sixtyDaysAgo, totalCents: 999_999_00 });

    const res = await request(app).get(`${ADMIN}/stats/orders?preset=7d`).set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.stats.previous).toEqual({
      revenueCents: 2_000_00,
      orderCount: 1,
      averageOrderValueCents: 2_000_00,
    });
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
