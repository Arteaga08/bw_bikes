import { describe, expect, it } from "vitest";
import { Coupon, CouponRedemption, type ICoupon } from "../src/models/index.js";
import { couponService } from "../src/services/coupon.service.js";
import { AppError } from "../src/utils/index.js";
import { createUser, seedAccessoryWithVariant, seedBikeWithVariant } from "./helpers/factories.js";

/**
 * The rules that decide whether a discount is owed, and the guarantee that it
 * is only ever spent once.
 *
 * These run against the service directly rather than over HTTP: the storefront
 * that would exercise them end to end is M13, and the arithmetic and the
 * concurrency are worth pinning down now regardless.
 */

const CODE = "PRUEBA10";

async function seedCoupon(overrides: Record<string, unknown> = {}): Promise<ICoupon> {
  return Coupon.create({
    code: CODE,
    name: "Campaña de prueba",
    type: "percent_off",
    percentOffBps: 1_000,
    ...overrides,
  });
}

function line(overrides: Record<string, unknown> = {}) {
  return {
    itemType: "bike" as const,
    itemId: "000000000000000000000001",
    sku: "BK-1",
    name: "Bici",
    brand: "Specialized",
    fulfillmentMode: "in_stock" as const,
    unitPriceCents: 100_000,
    qty: 1,
    lineTotalCents: 100_000,
    ...overrides,
  };
}

async function customerId(email = "cliente@example.com"): Promise<string> {
  const user = await createUser({ email, password: "Correct-Horse-Customer-1", role: "customer" });
  return String(user._id);
}

const evaluateWith = async (userId: string, lines = [line()], shippingCents = 0) =>
  couponService.evaluate({
    code: CODE,
    userId,
    lines,
    subtotalCents: lines.reduce((total, current) => total + current.lineTotalCents, 0),
    shippingCents,
  });

describe("couponService.evaluate — eligibility", () => {
  it("computes a percentage against the eligible subtotal", async () => {
    await seedCoupon();
    const result = await evaluateWith(await customerId());

    expect(result.discountCents).toBe(10_000);
    expect(result.applied).toMatchObject({ code: CODE, type: "percent_off", discountCents: 10_000 });
  });

  it("caps a percentage at maxDiscountCents", async () => {
    await seedCoupon({ maxDiscountCents: 5_000 });
    const result = await evaluateWith(await customerId());

    expect(result.discountCents).toBe(5_000);
  });

  // Shipping is what keeps the payable total above the gateway floor here —
  // without it this same coupon is (correctly) refused, which the floor's own
  // test covers.
  it("never lets a fixed amount exceed what is in the cart", async () => {
    await seedCoupon({ type: "amount_off", percentOffBps: undefined, amountOffCents: 500_000 });
    const result = await evaluateWith(await customerId(), [line()], 25_000);

    expect(result.discountCents).toBe(100_000);
  });

  it("refuses a deactivated campaign without revealing that it exists", async () => {
    await seedCoupon({ isActive: false });
    await expect(evaluateWith(await customerId())).rejects.toMatchObject({ statusCode: 404 });
  });

  it("refuses a campaign that has not started", async () => {
    await seedCoupon({ startsAt: new Date(Date.now() + 86_400_000) });
    await expect(evaluateWith(await customerId())).rejects.toThrow(/todavía no está vigente/);
  });

  it("refuses an expired campaign", async () => {
    await seedCoupon({ expiresAt: new Date(Date.now() - 1_000) });
    await expect(evaluateWith(await customerId())).rejects.toThrow(/ya expiró/);
  });

  it("refuses a cart below the minimum purchase, quoting the minimum in pesos", async () => {
    await seedCoupon({ minSubtotalCents: 500_000 });
    await expect(evaluateWith(await customerId())).rejects.toThrow(/desde \$5000\.00 MXN/);
  });

  it("measures the minimum against the whole subtotal, not the scoped slice", async () => {
    // Scoped to accessories, but the minimum is cleared by the bike as well.
    await seedCoupon({ minSubtotalCents: 150_000, scope: { kind: "accessories" } });
    const lines = [line(), line({ itemType: "accessory", sku: "AC-1", lineTotalCents: 60_000 })];

    const result = await evaluateWith(await customerId(), lines);

    // 10% of the accessory only — the bike raised the subtotal but is not discounted.
    expect(result.discountCents).toBe(6_000);
  });
});

describe("couponService.evaluate — scope", () => {
  it("discounts only the bikes when scoped to bikes", async () => {
    await seedCoupon({ scope: { kind: "bikes" } });
    const lines = [line(), line({ itemType: "accessory", sku: "AC-1", lineTotalCents: 50_000 })];

    const result = await evaluateWith(await customerId(), lines);

    expect(result.discountCents).toBe(10_000);
  });

  it("refuses when nothing in the cart falls inside the scope", async () => {
    await seedCoupon({ scope: { kind: "accessories" } });
    await expect(evaluateWith(await customerId())).rejects.toThrow(/no aplica a los productos/);
  });

  it("resolves real categories for a category-scoped campaign", async () => {
    const { bike, itemId, sku } = await seedBikeWithVariant({ price: 100_000 });
    await seedCoupon({ scope: { kind: "categories", itemType: "bike", categoryIds: [String(bike.category)] } });

    const result = await evaluateWith(await customerId(), [line({ itemId, sku })]);

    expect(result.discountCents).toBe(10_000);
  });

  it("ignores a product sitting in a category the campaign does not name", async () => {
    const { itemId, sku } = await seedBikeWithVariant({ price: 100_000 });
    await seedCoupon({
      scope: { kind: "categories", itemType: "bike", categoryIds: ["000000000000000000000009"] },
    });

    await expect(evaluateWith(await customerId(), [line({ itemId, sku })])).rejects.toThrow(
      /no aplica a los productos/,
    );
  });

  /**
   * Bikes and accessories keep two independent category trees, so an id from
   * one must never match a product in the other.
   */
  it("does not match a bike category id against an accessory", async () => {
    const { bike } = await seedBikeWithVariant();
    const accessory = await seedAccessoryWithVariant({ price: 100_000 });
    await seedCoupon({
      scope: { kind: "categories", itemType: "accessory", categoryIds: [String(bike.category)] },
    });

    await expect(
      evaluateWith(await customerId(), [
        line({ itemType: "accessory", itemId: accessory.itemId, sku: accessory.sku }),
      ]),
    ).rejects.toThrow(/no aplica a los productos/);
  });
});

describe("couponService.evaluate — limits", () => {
  it("refuses once the campaign's global limit is spent", async () => {
    await seedCoupon({ maxRedemptionsTotal: 2, redemptionCount: 2 });
    await expect(evaluateWith(await customerId())).rejects.toThrow(/límite de canjes/);
  });

  it("refuses a customer who already used their allowance, while the campaign is still live", async () => {
    const coupon = await seedCoupon({ maxRedemptionsTotal: 100, maxRedemptionsPerCustomer: 1 });
    const userId = await customerId();

    await couponService.redeem({ coupon, userId, orderId: "000000000000000000000010", discountCents: 10_000 });

    await expect(evaluateWith(userId)).rejects.toThrow(/máximo de veces/);
  });

  it("still serves a different customer after the first one used their allowance", async () => {
    const coupon = await seedCoupon({ maxRedemptionsPerCustomer: 1 });
    const first = await customerId("uno@example.com");

    await couponService.redeem({ coupon, userId: first, orderId: "000000000000000000000010", discountCents: 10_000 });

    const second = await evaluateWith(await customerId("dos@example.com"));
    expect(second.discountCents).toBe(10_000);
  });

  it("allows a second redemption when the per-customer cap allows it", async () => {
    const coupon = await seedCoupon({ maxRedemptionsPerCustomer: 2 });
    const userId = await customerId();

    await couponService.redeem({ coupon, userId, orderId: "000000000000000000000010", discountCents: 10_000 });

    await expect(evaluateWith(userId)).resolves.toMatchObject({ discountCents: 10_000 });
  });
});

describe("couponService.evaluate — the gateway floor", () => {
  it("refuses a discount that would drop the payable total under Stripe's minimum", async () => {
    await seedCoupon({ type: "amount_off", percentOffBps: undefined, amountOffCents: 99_900 });

    await expect(evaluateWith(await customerId())).rejects.toThrow(/por debajo del mínimo/);
  });

  it("allows the same discount once shipping lifts the total back over the floor", async () => {
    await seedCoupon({ type: "amount_off", percentOffBps: undefined, amountOffCents: 99_900 });

    const result = await evaluateWith(await customerId(), [line()], 25_000);
    expect(result.discountCents).toBe(99_900);
  });
});

describe("couponService.redeem — idempotency and concurrency", () => {
  it("spends exactly one redemption per order, however many times it is called", async () => {
    const coupon = await seedCoupon({ maxRedemptionsTotal: 5, maxRedemptionsPerCustomer: 5 });
    const userId = await customerId();
    const orderId = "000000000000000000000010";

    await couponService.redeem({ coupon, userId, orderId, discountCents: 10_000 });
    await couponService.redeem({ coupon, userId, orderId, discountCents: 10_000 });
    await couponService.redeem({ coupon, userId, orderId, discountCents: 10_000 });

    const stored = await Coupon.findById(coupon._id).exec();
    expect(stored?.redemptionCount).toBe(1);
    expect(await CouponRedemption.countDocuments({ couponId: coupon._id })).toBe(1);
  });

  it("counts two different orders separately", async () => {
    const coupon = await seedCoupon({ maxRedemptionsPerCustomer: 5 });
    const userId = await customerId();

    await couponService.redeem({ coupon, userId, orderId: "000000000000000000000010", discountCents: 10_000 });
    await couponService.redeem({ coupon, userId, orderId: "000000000000000000000011", discountCents: 10_000 });

    const stored = await Coupon.findById(coupon._id).exec();
    expect(stored?.redemptionCount).toBe(2);
  });

  it("refuses to hand out the last redemption twice", async () => {
    const coupon = await seedCoupon({ maxRedemptionsTotal: 1, maxRedemptionsPerCustomer: 5 });
    const userId = await customerId();

    await couponService.redeem({ coupon, userId, orderId: "000000000000000000000010", discountCents: 10_000 });

    await expect(
      couponService.redeem({ coupon, userId, orderId: "000000000000000000000011", discountCents: 10_000 }),
    ).rejects.toBeInstanceOf(AppError);

    const stored = await Coupon.findById(coupon._id).exec();
    expect(stored?.redemptionCount).toBe(1);
  });

  it("lets only one of several simultaneous checkouts claim the final redemption", async () => {
    const coupon = await seedCoupon({ maxRedemptionsTotal: 1, maxRedemptionsPerCustomer: 5 });
    const userId = await customerId();

    const attempts = await Promise.allSettled(
      ["11", "12", "13", "14", "15"].map((suffix) =>
        couponService.redeem({
          coupon,
          userId,
          orderId: `0000000000000000000000${suffix}`,
          discountCents: 10_000,
        }),
      ),
    );

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);

    const stored = await Coupon.findById(coupon._id).exec();
    expect(stored?.redemptionCount).toBe(1);
    expect(await CouponRedemption.countDocuments({ couponId: coupon._id })).toBe(1);
  });
});

describe("couponService.releaseForOrder", () => {
  it("returns the redemption to the pool and lets the customer use it again", async () => {
    const coupon = await seedCoupon({ maxRedemptionsPerCustomer: 1 });
    const userId = await customerId();
    const orderId = "000000000000000000000010";

    await couponService.redeem({ coupon, userId, orderId, discountCents: 10_000 });
    await expect(evaluateWith(userId)).rejects.toThrow(/máximo de veces/);

    await couponService.releaseForOrder(orderId);

    const stored = await Coupon.findById(coupon._id).exec();
    expect(stored?.redemptionCount).toBe(0);
    expect(await CouponRedemption.countDocuments()).toBe(0);
    await expect(evaluateWith(userId)).resolves.toMatchObject({ discountCents: 10_000 });
  });

  it("is a no-op for an order that never carried a coupon", async () => {
    const coupon = await seedCoupon();
    await couponService.releaseForOrder("000000000000000000000099");

    const stored = await Coupon.findById(coupon._id).exec();
    expect(stored?.redemptionCount).toBe(0);
  });

  it("never drives the counter negative when called twice", async () => {
    const coupon = await seedCoupon();
    const userId = await customerId();
    const orderId = "000000000000000000000010";

    await couponService.redeem({ coupon, userId, orderId, discountCents: 10_000 });
    await couponService.releaseForOrder(orderId);
    await couponService.releaseForOrder(orderId);

    const stored = await Coupon.findById(coupon._id).exec();
    expect(stored?.redemptionCount).toBe(0);
  });
});
