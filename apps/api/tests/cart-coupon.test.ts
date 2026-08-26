import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { Cart, Coupon } from "../src/models/index.js";
import { Types } from "mongoose";
import { createCustomerSession } from "./helpers/admin-session.js";
import { createInventoryItemDoc, seedBikeWithVariant } from "./helpers/factories.js";

const CART = "/api/v1/cart";

/**
 * The customer-facing half of M18: applying a code to a cart, and what the
 * cart does when that code later stops being usable.
 *
 * The storefront that drives these endpoints is M13; this is the contract it
 * will be built against.
 */
describe("cart coupons", () => {
  let app: ReturnType<typeof buildApp>;
  let cookie: string;
  let bike: Awaited<ReturnType<typeof seedBikeWithVariant>>;

  beforeEach(async () => {
    app = buildApp();
    cookie = await createCustomerSession(app, "coupon-customer@example.com");
    bike = await seedBikeWithVariant({ sku: "BK-COUPON-M", price: 1_000_000 });
    // Without stock the line is not purchasable, and the cart prices only the
    // purchasable ones — a coupon would correctly find nothing to discount.
    await createInventoryItemDoc({ itemId: new Types.ObjectId(bike.itemId), sku: bike.sku, onHand: 5 });

    await Coupon.create({
      code: "PRUEBA10",
      name: "Campaña de prueba",
      type: "percent_off",
      percentOffBps: 1_000,
    });

    await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 });
  });

  it("applies a code and folds the discount into the totals", async () => {
    const res = await request(app).post(`${CART}/coupon`).set("Cookie", cookie).send({ code: "PRUEBA10" });

    expect(res.status).toBe(200);
    expect(res.body.data.cart.coupon).toMatchObject({ code: "PRUEBA10", discountCents: 100_000 });
    expect(res.body.data.cart.discountCents).toBe(100_000);
    expect(res.body.data.cart.totalCents).toBe(
      res.body.data.cart.subtotalCents - 100_000 + res.body.data.cart.shippingCents,
    );
  });

  it("derives the cart's IVA from the discounted total", async () => {
    const before = await request(app).get(CART).set("Cookie", cookie);
    await request(app).post(`${CART}/coupon`).set("Cookie", cookie).send({ code: "PRUEBA10" });
    const after = await request(app).get(CART).set("Cookie", cookie);

    expect(after.body.data.cart.taxCents).toBeLessThan(before.body.data.cart.taxCents);
    expect(after.body.data.cart.taxCents).toBe(
      Math.round((after.body.data.cart.totalCents * 1_600) / 11_600),
    );
  });

  it("accepts a code in any casing", async () => {
    const res = await request(app).post(`${CART}/coupon`).set("Cookie", cookie).send({ code: "prueba10" });

    expect(res.status).toBe(200);
    expect(res.body.data.cart.coupon.code).toBe("PRUEBA10");
  });

  it("stores only the code, never the amount", async () => {
    await request(app).post(`${CART}/coupon`).set("Cookie", cookie).send({ code: "PRUEBA10" });

    const stored = await Cart.findOne({}).lean().exec();
    expect(stored?.couponCode).toBe("PRUEBA10");
    expect(JSON.stringify(stored)).not.toContain("discountCents");
  });

  it("explains why a code was refused instead of silently ignoring it", async () => {
    const res = await request(app).post(`${CART}/coupon`).set("Cookie", cookie).send({ code: "NOEXISTE" });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Este cupón no es válido.");
  });

  it("removes an applied coupon", async () => {
    await request(app).post(`${CART}/coupon`).set("Cookie", cookie).send({ code: "PRUEBA10" });
    const res = await request(app).delete(`${CART}/coupon`).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.cart.coupon).toBeUndefined();
    expect(res.body.data.cart.discountCents).toBe(0);
  });

  /**
   * The reason `toPublicCart` uses `evaluateQuietly`. A customer whose coupon
   * expired overnight must still be able to open their cart — at full price,
   * but visible and actionable.
   */
  it("still renders the cart at full price after the stored coupon expires", async () => {
    await request(app).post(`${CART}/coupon`).set("Cookie", cookie).send({ code: "PRUEBA10" });
    await Coupon.updateOne({ code: "PRUEBA10" }, { $set: { expiresAt: new Date(Date.now() - 1_000) } }).exec();

    const res = await request(app).get(CART).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.cart.coupon).toBeUndefined();
    expect(res.body.data.cart.discountCents).toBe(0);
    expect(res.body.data.cart.lines).toHaveLength(1);
  });

  it("does the same when the campaign is deactivated under the customer", async () => {
    await request(app).post(`${CART}/coupon`).set("Cookie", cookie).send({ code: "PRUEBA10" });
    await Coupon.updateOne({ code: "PRUEBA10" }, { $set: { isActive: false } }).exec();

    const res = await request(app).get(CART).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.cart.discountCents).toBe(0);
  });

  it("rejects a body that tries to dictate its own discount", async () => {
    const res = await request(app)
      .post(`${CART}/coupon`)
      .set("Cookie", cookie)
      .send({ code: "PRUEBA10", discountCents: 999_999 });

    expect(res.status).toBe(200);
    // `stripUnknown` drops it before the service ever sees it.
    expect(res.body.data.cart.discountCents).toBe(100_000);
  });

  it("requires authentication", async () => {
    const res = await request(app).post(`${CART}/coupon`).send({ code: "PRUEBA10" });
    expect(res.status).toBe(401);
  });
});
