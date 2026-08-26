import { Types } from "mongoose";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { CouponRedemption, Order } from "../src/models/index.js";
import { createAdminSession, createCustomerSession } from "./helpers/admin-session.js";
import { createUser } from "./helpers/factories.js";

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
 * Seeds an order straight against the model — this file tests the CRM
 * *readers*, not checkout, whose own rigor lives in `order-checkout.test.ts`.
 */
async function seedOrder(userId: string, overrides: { status: string; totalCents?: number } = { status: "paid" }) {
  const totalCents = overrides.totalCents ?? 10_000_00;
  return Order.create({
    orderNumber: `BW-2026-${Math.random().toString(16).slice(2, 8).toUpperCase()}`,
    userId,
    status: overrides.status,
    lines: [
      {
        itemType: "bike",
        itemId: String(new Types.ObjectId()),
        sku: "BK-CRM-M",
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
    statusHistory: [{ status: overrides.status, at: new Date(), actorType: "system" }],
  });
}

async function seedCustomer(email: string, firstName = "Ana", lastName = "Pérez") {
  const user = await createUser({ email, password: "Correct-Horse-Customer-1", role: "customer", firstName, lastName });
  return String(user._id);
}

describe("Customers — admin registry", () => {
  it("lists a registered customer who never bought, with zeroed aggregates", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    await seedCustomer("nunca-compro@example.com");

    const res = await request(app).get(`${ADMIN}/customers`).set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    const customer = res.body.data.customers.find((row: { email: string }) => row.email === "nunca-compro@example.com");
    expect(customer).toMatchObject({ orderCount: 0, totalSpentCents: 0 });
    expect(customer.lastOrderAt).toBeUndefined();
  });

  it("derives purchase count and lifetime value from the orders", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    const userId = await seedCustomer("compro@example.com");

    await seedOrder(userId, { status: "delivered", totalCents: 30_000_00 });
    await seedOrder(userId, { status: "paid", totalCents: 20_000_00 });

    const res = await request(app).get(`${ADMIN}/customers?search=compro@example.com`).set("Cookie", adminCookie);

    expect(res.body.data.customers[0]).toMatchObject({ orderCount: 2, totalSpentCents: 50_000_00 });
    expect(res.body.data.customers[0].lastOrderAt).toBeTruthy();
  });

  /**
   * "Compró" and "gastó" are different questions. A refund still means this
   * person bought — collapsing the two would either hide real customers or
   * inflate their lifetime value.
   */
  it("counts a refunded order as a purchase but not as money kept", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    const userId = await seedCustomer("devolvio@example.com");

    await seedOrder(userId, { status: "paid", totalCents: 10_000_00 });
    await seedOrder(userId, { status: "refunded", totalCents: 90_000_00 });

    const res = await request(app).get(`${ADMIN}/customers?search=devolvio@example.com`).set("Cookie", adminCookie);

    expect(res.body.data.customers[0]).toMatchObject({ orderCount: 2, totalSpentCents: 10_000_00 });
  });

  it("excludes a pending_payment order from both figures", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    const userId = await seedCustomer("carrito-abandonado@example.com");

    await seedOrder(userId, { status: "pending_payment", totalCents: 50_000_00 });

    const res = await request(app)
      .get(`${ADMIN}/customers?search=carrito-abandonado@example.com`)
      .set("Cookie", adminCookie);

    expect(res.body.data.customers[0]).toMatchObject({ orderCount: 0, totalSpentCents: 0 });
  });

  it("filters to the customers who bought more than once", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    const recurrent = await seedCustomer("recurrente@example.com");
    const once = await seedCustomer("una-vez@example.com");

    await seedOrder(recurrent, { status: "paid" });
    await seedOrder(recurrent, { status: "delivered" });
    await seedOrder(once, { status: "paid" });

    const res = await request(app).get(`${ADMIN}/customers?repeatBuyersOnly=true`).set("Cookie", adminCookie);

    const emails = res.body.data.customers.map((row: { email: string }) => row.email);
    expect(emails).toContain("recurrente@example.com");
    expect(emails).not.toContain("una-vez@example.com");
    expect(res.body.meta.total).toBe(1);
  });

  it("sorts by lifetime value by default, biggest spender first", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    const small = await seedCustomer("chico@example.com");
    const big = await seedCustomer("grande@example.com");

    await seedOrder(small, { status: "paid", totalCents: 1_000_00 });
    await seedOrder(big, { status: "paid", totalCents: 200_000_00 });

    const res = await request(app).get(`${ADMIN}/customers`).set("Cookie", adminCookie);

    expect(res.body.data.customers[0].email).toBe("grande@example.com");
  });

  it("searches by name as well as email", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    await seedCustomer("buscar@example.com", "Rodrigo", "Villalobos");

    const res = await request(app).get(`${ADMIN}/customers?search=villalobos`).set("Cookie", adminCookie);

    expect(res.body.data.customers).toHaveLength(1);
    expect(res.body.data.customers[0].email).toBe("buscar@example.com");
  });

  /** Staff emails have no business on a screen built for customer outreach. */
  it("never lists admin accounts", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app, { email: "staff@example.com" });

    const res = await request(app).get(`${ADMIN}/customers`).set("Cookie", adminCookie);

    const emails = res.body.data.customers.map((row: { email: string }) => row.email);
    expect(emails).not.toContain("staff@example.com");
  });

  it("returns the detail with recent orders, redeemed coupons and the average ticket", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    const userId = await seedCustomer("detalle@example.com");

    const order = await seedOrder(userId, { status: "paid", totalCents: 40_000_00 });
    await seedOrder(userId, { status: "delivered", totalCents: 20_000_00 });
    await CouponRedemption.create({
      couponId: new Types.ObjectId(),
      userId,
      orderId: order._id,
      code: "PRUEBA10",
      discountCents: 5_000_00,
    });

    const res = await request(app).get(`${ADMIN}/customers/${userId}`).set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.customer).toMatchObject({
      email: "detalle@example.com",
      orderCount: 2,
      totalSpentCents: 60_000_00,
      averageOrderCents: 30_000_00,
    });
    expect(res.body.data.customer.recentOrders).toHaveLength(2);
    expect(res.body.data.customer.redeemedCoupons[0]).toMatchObject({
      code: "PRUEBA10",
      orderNumber: order.orderNumber,
      discountCents: 5_000_00,
    });
  });

  it("answers 404 for an id that is not a customer", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    const res = await request(app).get(`${ADMIN}/customers/${new Types.ObjectId()}`).set("Cookie", adminCookie);

    expect(res.status).toBe(404);
  });
});

describe("Customers — stats", () => {
  it("separates buyers from repeat buyers and computes the average ticket", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    const recurrent = await seedCustomer("stats-recurrente@example.com");
    const once = await seedCustomer("stats-una-vez@example.com");
    await seedCustomer("stats-nunca@example.com");

    await seedOrder(recurrent, { status: "paid", totalCents: 30_000_00 });
    await seedOrder(recurrent, { status: "delivered", totalCents: 10_000_00 });
    await seedOrder(once, { status: "paid", totalCents: 20_000_00 });

    const res = await request(app).get(`${ADMIN}/stats/customers`).set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.stats).toMatchObject({
      totalCustomers: 3,
      buyers: 2,
      repeatBuyers: 1,
      averageOrderCents: 20_000_00,
    });
  });

  /** Ranking by order count would put ten helmets above one bike. */
  it("ranks top buyers by money kept, not by number of orders", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    const many = await seedCustomer("muchas-compras@example.com", "Many", "Small");
    const big = await seedCustomer("una-grande@example.com", "One", "Big");

    for (let index = 0; index < 5; index++) await seedOrder(many, { status: "paid", totalCents: 1_000_00 });
    await seedOrder(big, { status: "paid", totalCents: 200_000_00 });

    const res = await request(app).get(`${ADMIN}/stats/customers`).set("Cookie", adminCookie);

    expect(res.body.data.stats.topBuyers[0]).toMatchObject({
      email: "una-grande@example.com",
      name: "One Big",
      totalSpentCents: 200_000_00,
    });
    expect(res.body.data.stats.topBuyers[1]!.email).toBe("muchas-compras@example.com");
  });

  it("keeps a refunded order out of the ranking's money", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    const userId = await seedCustomer("stats-devolvio@example.com");

    await seedOrder(userId, { status: "paid", totalCents: 10_000_00 });
    await seedOrder(userId, { status: "refunded", totalCents: 90_000_00 });

    const res = await request(app).get(`${ADMIN}/stats/customers`).set("Cookie", adminCookie);

    expect(res.body.data.stats.topBuyers[0]).toMatchObject({ totalSpentCents: 10_000_00 });
  });
});

describe("Customers — authorization", () => {
  it("rejects an anonymous caller with 401", async () => {
    const app: App = buildApp();
    expect((await request(app).get(`${ADMIN}/customers`)).status).toBe(401);
  });

  it("rejects an authenticated customer with 403", async () => {
    const app: App = buildApp();
    const customerCookie = await createCustomerSession(app);

    expect((await request(app).get(`${ADMIN}/customers`).set("Cookie", customerCookie)).status).toBe(403);
    expect((await request(app).get(`${ADMIN}/stats/customers`).set("Cookie", customerCookie)).status).toBe(403);
  });
});
