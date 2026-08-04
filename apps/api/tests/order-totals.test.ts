import type { OrderLineSnapshot } from "@bw-bikes/shared";
import { describe, expect, it } from "vitest";
import { AppError } from "../src/utils/index.js";
import {
  buildLineSnapshots,
  calculateTotals,
  resolveCaptureMethod,
  resolveCartLines,
} from "../src/services/order-pricing.js";
import { seedAccessoryWithVariant, seedBikeWithVariant } from "./helpers/factories.js";

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

describe("calculateTotals", () => {
  it("sums line totals and charges exactly the subtotal plus shipping", () => {
    const totals = calculateTotals([
      line({ unitPriceCents: 8_500_000, qty: 1, lineTotalCents: 8_500_000 }),
      line({ unitPriceCents: 4_500_00, qty: 2, lineTotalCents: 9_000_00 }),
    ]);

    expect(totals.subtotalCents).toBe(8_500_000 + 9_000_00);
    expect(totals.shippingCents).toBe(0);
    expect(totals.totalCents).toBe(totals.subtotalCents + totals.shippingCents);
    expect(totals.currency).toBe("MXN");
  });

  it("breaks IVA out of the total instead of adding it on top", () => {
    const totals = calculateTotals([line({ unitPriceCents: 8_500_000, qty: 1, lineTotalCents: 8_500_000 })]);

    // 16/116 of the total, because the catalog price already includes IVA.
    expect(totals.taxCents).toBe(1_172_414);
    // The identity that matters: tax is contained in the total, never added.
    expect(totals.totalCents).toBe(8_500_000);
    expect(totals.taxCents).toBeLessThan(totals.totalCents);
  });

  it("keeps every amount an integer number of cents", () => {
    const totals = calculateTotals([line({ unitPriceCents: 3_333_33, qty: 3, lineTotalCents: 9_999_99 })]);

    for (const amount of [totals.subtotalCents, totals.taxCents, totals.shippingCents, totals.totalCents]) {
      expect(Number.isInteger(amount)).toBe(true);
    }
  });

  it("returns zeroes for an empty line list without dividing by anything", () => {
    const totals = calculateTotals([]);
    expect(totals).toMatchObject({ subtotalCents: 0, taxCents: 0, shippingCents: 0, totalCents: 0 });
  });

  it("refuses a line whose lineTotalCents does not equal unitPrice × qty", () => {
    // The guard exists because `lineTotalCents` is what gets charged. A line
    // built anywhere but here must not be able to smuggle in its own total.
    expect(() => calculateTotals([line({ unitPriceCents: 1_000_00, qty: 2, lineTotalCents: 1_000_00 })])).toThrow(
      AppError,
    );
  });
});

describe("resolveCaptureMethod", () => {
  it("captures automatically when every line is in stock", () => {
    expect(resolveCaptureMethod([{ fulfillmentMode: "in_stock" }, { fulfillmentMode: "in_stock" }])).toBe("automatic");
  });

  it("switches the WHOLE order to manual when a single line is on_request", () => {
    expect(
      resolveCaptureMethod([
        { fulfillmentMode: "in_stock" },
        { fulfillmentMode: "in_stock" },
        { fulfillmentMode: "on_request" },
      ]),
    ).toBe("manual");
  });

  it("treats preorder exactly like on_request", () => {
    expect(resolveCaptureMethod([{ fulfillmentMode: "in_stock" }, { fulfillmentMode: "preorder" }])).toBe("manual");
    expect(resolveCaptureMethod([{ fulfillmentMode: "preorder" }])).toBe("manual");
  });
});

describe("resolveCartLines", () => {
  it("prices a line from the catalog, ignoring anything the client might send", async () => {
    const { itemId, sku } = await seedBikeWithVariant({ price: 19_999_900 });

    const [resolution] = await resolveCartLines([{ itemType: "bike", itemId, sku, qty: 2 }]);

    expect(resolution?.ok).toBe(true);
    expect(resolution?.ok === true && resolution.line.snapshot).toMatchObject({
      unitPriceCents: 19_999_900,
      qty: 2,
      lineTotalCents: 39_999_800,
      brand: "Specialized",
      fulfillmentMode: "in_stock",
    });
  });

  it("prefers the variant price override over the product price", async () => {
    const { itemId, sku } = await seedBikeWithVariant({ price: 19_999_900, variantPrice: 21_500_000 });

    const [resolution] = await resolveCartLines([{ itemType: "bike", itemId, sku, qty: 1 }]);

    expect(resolution?.ok === true && resolution.line.snapshot.unitPriceCents).toBe(21_500_000);
  });

  it("snapshots the primary gallery image by order, not by array position", async () => {
    const { itemId, sku } = await seedBikeWithVariant({ withGallery: true });

    const [resolution] = await resolveCartLines([{ itemType: "bike", itemId, sku, qty: 1 }]);

    expect(resolution?.ok === true && resolution.line.snapshot.imagePublicId).toContain("primary");
  });

  it("resolves accessories from their own collection", async () => {
    const { itemId, sku } = await seedAccessoryWithVariant({ price: 4_500_00 });

    const [resolution] = await resolveCartLines([{ itemType: "accessory", itemId, sku, qty: 1 }]);

    expect(resolution?.ok === true && resolution.line.snapshot).toMatchObject({
      itemType: "accessory",
      unitPriceCents: 4_500_00,
      brand: "Giro",
    });
  });

  it("reports an archived product as not purchasable instead of throwing", async () => {
    const { itemId, sku } = await seedBikeWithVariant({ isActive: false });

    const [resolution] = await resolveCartLines([{ itemType: "bike", itemId, sku, qty: 1 }]);

    expect(resolution?.ok).toBe(false);
    expect(resolution?.ok === false && resolution.reason).toMatch(/disponible/i);
  });

  it("reports an inactive variant as not purchasable", async () => {
    const { itemId, sku } = await seedBikeWithVariant({ variantActive: false });

    const [resolution] = await resolveCartLines([{ itemType: "bike", itemId, sku, qty: 1 }]);

    expect(resolution?.ok).toBe(false);
  });

  it("reports an unknown SKU as not purchasable", async () => {
    const { itemId } = await seedBikeWithVariant({ sku: "BK-REAL-M" });

    const [resolution] = await resolveCartLines([{ itemType: "bike", itemId, sku: "BK-GHOST-M", qty: 1 }]);

    expect(resolution?.ok).toBe(false);
  });

  it("reads both catalogs in one pass and preserves the caller's line order", async () => {
    const bike = await seedBikeWithVariant({ sku: "BK-MIX-M" });
    const accessory = await seedAccessoryWithVariant({ sku: "AC-MIX-U" });

    const resolutions = await resolveCartLines([
      { itemType: "accessory", itemId: accessory.itemId, sku: accessory.sku, qty: 1 },
      { itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 },
    ]);

    expect(resolutions.map((r) => r.sku)).toEqual(["AC-MIX-U", "BK-MIX-M"]);
  });
});

describe("buildLineSnapshots", () => {
  it("returns snapshots when every line is purchasable", async () => {
    const bike = await seedBikeWithVariant({ sku: "BK-OK-M" });
    const accessory = await seedAccessoryWithVariant({ sku: "AC-OK-U" });

    const snapshots = await buildLineSnapshots([
      { itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 },
      { itemType: "accessory", itemId: accessory.itemId, sku: accessory.sku, qty: 2 },
    ]);

    expect(snapshots).toHaveLength(2);
    expect(snapshots[1]?.lineTotalCents).toBe(snapshots[1]!.unitPriceCents * 2);
  });

  it("throws a 409 naming the offending SKU when a line is no longer purchasable", async () => {
    const { itemId, sku } = await seedBikeWithVariant({ sku: "BK-GONE-M", isActive: false });

    let thrown: unknown;
    try {
      await buildLineSnapshots([{ itemType: "bike", itemId, sku, qty: 1 }]);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AppError);
    expect((thrown as AppError).statusCode).toBe(409);
    expect((thrown as AppError).message).toContain("BK-GONE-M");
  });

  it("refuses an empty cart — there is nothing to charge for", async () => {
    await expect(buildLineSnapshots([])).rejects.toThrow(AppError);
  });
});
