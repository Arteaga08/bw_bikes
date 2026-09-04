import type { PublicCatalogFilterOptions } from "@bw-bikes/shared";
import { describe, expect, it } from "vitest";
import { mergeCatalogFilterOptions } from "./merge-filter-options";

function options(overrides: Partial<PublicCatalogFilterOptions> = {}): PublicCatalogFilterOptions {
  return { brands: [], sizes: [], colors: [], price: null, specs: [], ...overrides };
}

describe("mergeCatalogFilterOptions", () => {
  it("concatenates brands, deduping by slug (first occurrence wins)", () => {
    const bike = options({ brands: [{ id: "1", name: "Trek", slug: "trek", order: 0 }] });
    const accessory = options({
      brands: [
        { id: "1b", name: "Trek (accesorios)", slug: "trek", order: 0 },
        { id: "2", name: "Shimano", slug: "shimano", order: 1 },
      ],
    });

    const merged = mergeCatalogFilterOptions(bike, accessory);
    expect(merged.brands).toEqual([
      { id: "1", name: "Trek", slug: "trek", order: 0 },
      { id: "2", name: "Shimano", slug: "shimano", order: 1 },
    ]);
  });

  it("unions sizes, preserving first-appearance order", () => {
    const bike = options({ sizes: ["M", "L"] });
    const accessory = options({ sizes: ["U", "M"] });

    expect(mergeCatalogFilterOptions(bike, accessory).sizes).toEqual(["M", "L", "U"]);
  });

  it("dedupes colors by value", () => {
    const bike = options({ colors: [{ value: "Negro", hex: "#000", secondaryHex: null }] });
    const accessory = options({
      colors: [
        { value: "Negro", hex: "#111", secondaryHex: null },
        { value: "Rojo", hex: "#f00", secondaryHex: null },
      ],
    });

    expect(mergeCatalogFilterOptions(bike, accessory).colors).toEqual([
      { value: "Negro", hex: "#000", secondaryHex: null },
      { value: "Rojo", hex: "#f00", secondaryHex: null },
    ]);
  });

  it("combines price ranges into the widest min/max", () => {
    const bike = options({ price: { min: 10_000_00, max: 50_000_00 } });
    const accessory = options({ price: { min: 500_00, max: 5_000_00 } });

    expect(mergeCatalogFilterOptions(bike, accessory).price).toEqual({ min: 500_00, max: 50_000_00 });
  });

  it("falls back to whichever side has a price range when the other is null", () => {
    const bike = options({ price: { min: 10_000_00, max: 50_000_00 } });
    const accessory = options({ price: null });

    expect(mergeCatalogFilterOptions(bike, accessory).price).toEqual({ min: 10_000_00, max: 50_000_00 });
    expect(mergeCatalogFilterOptions(accessory, bike).price).toEqual({ min: 10_000_00, max: 50_000_00 });
  });

  it("returns a null price range when both sides are null", () => {
    expect(mergeCatalogFilterOptions(options(), options()).price).toBeNull();
  });

  it("always returns an empty specs list", () => {
    const bike = options({ specs: [{ label: "Material", values: ["Carbono"] }] });
    expect(mergeCatalogFilterOptions(bike, options()).specs).toEqual([]);
  });
});
