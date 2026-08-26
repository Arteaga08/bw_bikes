import type { OrderLineSnapshot } from "@bw-bikes/shared";
import { describe, expect, it } from "vitest";
import { calculateTotals } from "../src/services/order-pricing.js";

/**
 * The arithmetic of a discounted order, pinned without a database.
 *
 * Sibling of `order-totals.test.ts` and deliberately in the same style: the
 * exact cent figures are written out, because a coupon that is off by one peso
 * is a coupon that shows one number on the cart and charges another.
 */

const line = (overrides: Partial<OrderLineSnapshot> = {}): OrderLineSnapshot => ({
  itemType: "bike",
  itemId: "000000000000000000000001",
  sku: "BK-1",
  name: "Bici",
  brand: "Specialized",
  fulfillmentMode: "in_stock",
  unitPriceCents: 1_000_00,
  qty: 1,
  lineTotalCents: 1_000_00,
  ...overrides,
});

describe("calculateTotals with a discount", () => {
  it("defaults to no discount, leaving the pre-M18 arithmetic untouched", () => {
    const totals = calculateTotals([line()], 25_000);

    expect(totals.discountCents).toBe(0);
    expect(totals.totalCents).toBe(1_000_00 + 25_000);
  });

  it("subtracts the discount from the subtotal before shipping is added", () => {
    const totals = calculateTotals([line({ unitPriceCents: 5_000_00, lineTotalCents: 5_000_00 })], 25_000, 1_600, 50_000);

    expect(totals.subtotalCents).toBe(5_000_00);
    expect(totals.discountCents).toBe(50_000);
    expect(totals.shippingCents).toBe(25_000);
    expect(totals.totalCents).toBe(5_000_00 - 50_000 + 25_000);
  });

  /**
   * The regression this whole feature could most easily have shipped with.
   *
   * IVA is *extracted* from the total, not added to it. If the discount were
   * applied after the extraction, the order would report tax on pesos the
   * customer never paid — wrong on a document the shop is accountable for.
   */
  it("derives IVA from the discounted total, not the full one", () => {
    const undiscounted = calculateTotals([line({ unitPriceCents: 8_500_000, lineTotalCents: 8_500_000 })]);
    const discounted = calculateTotals(
      [line({ unitPriceCents: 8_500_000, lineTotalCents: 8_500_000 })],
      0,
      1_600,
      500_000,
    );

    expect(discounted.totalCents).toBe(8_000_000);
    // 16/116 of 8,000,000 — not of 8,500,000.
    expect(discounted.taxCents).toBe(1_103_448);
    expect(discounted.taxCents).toBeLessThan(undiscounted.taxCents);
    expect(discounted.taxCents).toBe(Math.round((discounted.totalCents * 1_600) / 11_600));
  });

  it("keeps the identity subtotal - discount + shipping === total", () => {
    const totals = calculateTotals(
      [line({ unitPriceCents: 3_333_33, lineTotalCents: 3_333_33 }), line({ sku: "BK-2", lineTotalCents: 1_000_00 })],
      25_000,
      1_600,
      777_77,
    );

    expect(totals.totalCents).toBe(totals.subtotalCents - totals.discountCents + totals.shippingCents);
  });

  it("caps the discount at the subtotal so shipping is never refunded", () => {
    const totals = calculateTotals([line({ unitPriceCents: 1_000_00, lineTotalCents: 1_000_00 })], 25_000, 1_600, 500_000);

    expect(totals.discountCents).toBe(1_000_00);
    // The goods go to zero; the shipping fee still stands.
    expect(totals.totalCents).toBe(25_000);
  });

  it("refuses to let a negative discount inflate the total", () => {
    const totals = calculateTotals([line()], 0, 1_600, -50_000);

    expect(totals.discountCents).toBe(0);
    expect(totals.totalCents).toBe(1_000_00);
  });
});
