import type { OrderLineSnapshot } from "@bw-bikes/shared";
import { describe, expect, it } from "vitest";
import { shippingService } from "../src/services/shipping.service.js";

/**
 * Pure arithmetic, no DB — same reasoning as `order-totals.test.ts` pinning
 * down `calculateTotals`: `shipping.service.ts` reads nothing but each line's
 * `lineTotalCents`, so the rule can be pinned down without a catalog in sight.
 */
const line = (lineTotalCents: number): Pick<OrderLineSnapshot, "lineTotalCents"> => ({ lineTotalCents });

describe("shippingService.quote", () => {
  it("charges the flat accessory fee when the subtotal is under the threshold", () => {
    const quote = shippingService.quote([line(50_000)]);

    expect(quote).toEqual({ shippingCents: 25_000, isFree: false });
  });

  it("is free once the subtotal reaches the threshold", () => {
    const quote = shippingService.quote([line(200_000)]);

    expect(quote).toEqual({ shippingCents: 0, isFree: true });
  });

  it("is free above the threshold, not just exactly at it", () => {
    const quote = shippingService.quote([line(300_000)]);

    expect(quote.isFree).toBe(true);
  });

  it("sums every line before comparing against the threshold", () => {
    // Three accessories that individually sit under the threshold but clear it together.
    const quote = shippingService.quote([line(80_000), line(70_000), line(60_000)]);

    expect(quote).toEqual({ shippingCents: 0, isFree: true });
  });

  it("a bike alone already clears the threshold — no bike-specific rule needed", () => {
    // A bike's price per the spec ($80k-$300k MXN); even the low end clears $2,000.
    const quote = shippingService.quote([line(80_000_00)]);

    expect(quote).toEqual({ shippingCents: 0, isFree: true });
  });

  it("a bike plus an under-threshold accessory is still free, from the bike's own price", () => {
    const quote = shippingService.quote([line(80_000_00), line(50_000)]);

    expect(quote.isFree).toBe(true);
  });

  it("is free for an empty cart — nothing to ship is not the same as under the threshold", () => {
    const quote = shippingService.quote([]);

    expect(quote).toEqual({ shippingCents: 0, isFree: true });
  });
});
