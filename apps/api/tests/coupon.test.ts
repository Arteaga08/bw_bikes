import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { Coupon, CouponRedemption } from "../src/models/index.js";
import { createAdminSession, createCustomerSession } from "./helpers/admin-session.js";

const ADMIN = "/api/v1/admin";

type App = ReturnType<typeof buildApp>;

const validCoupon = {
  code: "BUENFIN20",
  name: "Buen Fin 2026",
  type: "percent_off",
  percentOffBps: 2_000,
  maxDiscountCents: 500_000,
};

describe("Coupons — admin CRUD", () => {
  it("creates a campaign and reads it back with its redemption counter at zero", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    const res = await request(app).post(`${ADMIN}/coupons`).set("Cookie", adminCookie).send(validCoupon);

    expect(res.status).toBe(201);
    expect(res.body.data.coupon).toMatchObject({
      code: "BUENFIN20",
      type: "percent_off",
      percentOffBps: 2_000,
      redemptionCount: 0,
      maxRedemptionsPerCustomer: 1,
      isActive: true,
      scope: { kind: "all" },
    });
  });

  it("uppercases the code, so the customer's casing never decides a match", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    const res = await request(app)
      .post(`${ADMIN}/coupons`)
      .set("Cookie", adminCookie)
      .send({ ...validCoupon, code: "verano-10" });

    expect(res.status).toBe(201);
    expect(res.body.data.coupon.code).toBe("VERANO-10");
  });

  it("rejects a duplicate code with 409", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    await request(app).post(`${ADMIN}/coupons`).set("Cookie", adminCookie).send(validCoupon);
    const res = await request(app).post(`${ADMIN}/coupons`).set("Cookie", adminCookie).send(validCoupon);

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("BUENFIN20");
  });

  it("refuses a coupon that declares both a percentage and a fixed amount", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    const res = await request(app)
      .post(`${ADMIN}/coupons`)
      .set("Cookie", adminCookie)
      .send({ ...validCoupon, amountOffCents: 50_000 });

    expect(res.status).toBe(400);
  });

  it("refuses a coupon that declares neither", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    const res = await request(app)
      .post(`${ADMIN}/coupons`)
      .set("Cookie", adminCookie)
      .send({ code: "VACIO", name: "Sin descuento", type: "percent_off" });

    expect(res.status).toBe(400);
  });

  it("refuses a category-scoped coupon that names no itemType", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    const res = await request(app)
      .post(`${ADMIN}/coupons`)
      .set("Cookie", adminCookie)
      .send({ ...validCoupon, scope: { kind: "categories", categoryIds: ["000000000000000000000001"] } });

    expect(res.status).toBe(400);
  });

  it("refuses an expiry that lands before the start", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    const res = await request(app)
      .post(`${ADMIN}/coupons`)
      .set("Cookie", adminCookie)
      .send({ ...validCoupon, startsAt: "2026-12-01T00:00:00.000Z", expiresAt: "2026-11-01T00:00:00.000Z" });

    expect(res.status).toBe(400);
  });

  it("searches by code and by campaign name", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    await request(app).post(`${ADMIN}/coupons`).set("Cookie", adminCookie).send(validCoupon);
    await request(app)
      .post(`${ADMIN}/coupons`)
      .set("Cookie", adminCookie)
      .send({ code: "VERANO10", name: "Campaña de verano", type: "amount_off", amountOffCents: 10_000 });

    const byName = await request(app).get(`${ADMIN}/coupons?search=verano`).set("Cookie", adminCookie);
    expect(byName.body.data.coupons).toHaveLength(1);
    expect(byName.body.data.coupons[0].code).toBe("VERANO10");

    const byCode = await request(app).get(`${ADMIN}/coupons?search=BUENFIN`).set("Cookie", adminCookie);
    expect(byCode.body.data.coupons).toHaveLength(1);
    expect(byCode.body.data.coupons[0].name).toBe("Buen Fin 2026");
  });

  it("updates a campaign without touching its redemption counter", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    const created = await request(app).post(`${ADMIN}/coupons`).set("Cookie", adminCookie).send(validCoupon);
    const id = created.body.data.coupon.id as string;

    const res = await request(app)
      .patch(`${ADMIN}/coupons/${id}`)
      .set("Cookie", adminCookie)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.data.coupon.isActive).toBe(false);
    expect(res.body.data.coupon.redemptionCount).toBe(0);
  });

  it("deletes a campaign nobody ever used", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    const created = await request(app).post(`${ADMIN}/coupons`).set("Cookie", adminCookie).send(validCoupon);
    const id = created.body.data.coupon.id as string;

    const res = await request(app).delete(`${ADMIN}/coupons/${id}`).set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    expect(await Coupon.countDocuments()).toBe(0);
  });

  /**
   * The ledger has to keep pointing at something. Deactivating is what the
   * admin actually wants when they say "borra este cupón" — the message says so.
   */
  it("refuses to delete a campaign that was already redeemed, and says to deactivate instead", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);

    const created = await request(app).post(`${ADMIN}/coupons`).set("Cookie", adminCookie).send(validCoupon);
    const id = created.body.data.coupon.id as string;

    await CouponRedemption.create({
      couponId: id,
      userId: "000000000000000000000001",
      orderId: "000000000000000000000002",
      code: "BUENFIN20",
      discountCents: 10_000,
    });

    const res = await request(app).delete(`${ADMIN}/coupons/${id}`).set("Cookie", adminCookie);

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("Desactívalo");
    expect(await Coupon.countDocuments()).toBe(1);
  });
});

describe("Coupons — authorization", () => {
  it("rejects an anonymous caller with 401", async () => {
    const app: App = buildApp();
    const res = await request(app).get(`${ADMIN}/coupons`);
    expect(res.status).toBe(401);
  });

  it("rejects an authenticated customer with 403", async () => {
    const app: App = buildApp();
    const customerCookie = await createCustomerSession(app);

    const res = await request(app).get(`${ADMIN}/coupons`).set("Cookie", customerCookie);
    expect(res.status).toBe(403);
  });

  it("does not let a customer create a campaign", async () => {
    const app: App = buildApp();
    const customerCookie = await createCustomerSession(app);

    const res = await request(app).post(`${ADMIN}/coupons`).set("Cookie", customerCookie).send(validCoupon);

    expect(res.status).toBe(403);
    expect(await Coupon.countDocuments()).toBe(0);
  });
});
