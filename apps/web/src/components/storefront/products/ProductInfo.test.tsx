import type { CustomerFit, PublicBike, PublicSizeGuideEntry } from "@bw-bikes/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicColorSwatch } from "@/lib/api/public-catalog";
import { ProductInfo } from "./ProductInfo";

// `SaveButton`, embedded next to "Comprar" (A5-guardados.md), needs a router and `WishlistProvider`.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/bicicletas/producto/x" }));
vi.mock("@/components/storefront/WishlistProvider", () => ({
  useWishlist: () => ({ isSignedIn: true, isSaved: () => false, toggle: vi.fn() }),
}));

function makeBike(overrides: Partial<PublicBike> = {}): PublicBike {
  return {
    id: "bike-1",
    name: "Trek Verve+ 2",
    slug: "trek-verve-plus-2",
    brand: { id: "brand-1", name: "Trek", slug: "trek", order: 0 },
    category: { id: "cat-1", name: "Montaña", slug: "montana", parent: null, order: 0, usesSizes: true },
    badges: [],
    description: "Una gran bici.",
    price: 2500000,
    currency: "MXN",
    variants: [],
    specGroups: [],
    gallery: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    shortDescription: "Una gran bici.",
    summary: [],
    relatedAccessories: [],
    ...overrides,
  };
}

const EMPTY_SWATCH_INDEX = new Map<string, PublicColorSwatch>();

describe("ProductInfo", () => {
  it("shows the base price and no color/size selectors for a single-variant product", () => {
    const bike = makeBike({
      variants: [{ sku: "SKU-1", fulfillmentMode: "in_stock", isActive: true }],
    });
    render(<ProductInfo product={bike} colorSwatchIndex={EMPTY_SWATCH_INDEX} />);

    expect(screen.getByText("$25,000.00")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Color" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Talla" })).not.toBeInTheDocument();
  });

  it("strips the brand from the name and shows the CTA disabled with the 'coming soon' title", () => {
    const bike = makeBike();
    render(<ProductInfo product={bike} colorSwatchIndex={EMPTY_SWATCH_INDEX} />);

    expect(screen.getByRole("heading", { name: "Verve+ 2" })).toBeInTheDocument();
    const cta = screen.getByRole("button", { name: "Comprar" });
    expect(cta).toBeDisabled();
    expect(cta).toHaveAttribute("title", "Disponible próximamente");
  });

  it("pre-selects the first color and shows only sizes matching it as available", () => {
    const bike = makeBike({
      variants: [
        { sku: "SKU-RED-MD", color: "Rojo", size: "MD", fulfillmentMode: "in_stock", isActive: true },
        { sku: "SKU-BLUE-LG", color: "Azul", size: "LG", fulfillmentMode: "in_stock", isActive: true },
      ],
    });
    render(<ProductInfo product={bike} colorSwatchIndex={EMPTY_SWATCH_INDEX} />);

    expect(screen.getByRole("radio", { name: "Rojo" })).toHaveAttribute("aria-checked", "true");
    // MD only exists under Rojo (the pre-selected color) — available.
    expect(screen.getByRole("radio", { name: "MD" })).toBeEnabled();
    // LG only exists under Azul — not available while Rojo is selected.
    expect(screen.getByRole("radio", { name: "LG" })).toBeDisabled();
  });

  it("updates the price once a variant with an override is fully selected", () => {
    const bike = makeBike({
      price: 2500000,
      variants: [
        { sku: "SKU-RED-MD", color: "Rojo", size: "MD", price: 2500000, fulfillmentMode: "in_stock", isActive: true },
        { sku: "SKU-RED-LG", color: "Rojo", size: "LG", price: 2700000, fulfillmentMode: "in_stock", isActive: true },
      ],
    });
    render(<ProductInfo product={bike} colorSwatchIndex={EMPTY_SWATCH_INDEX} />);

    expect(screen.getByText("$25,000.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "LG" }));
    expect(screen.getByText("$27,000.00")).toBeInTheDocument();
  });

  it("keeps the product name a step above the price in the type scale", () => {
    // El nombre es el título de la página; el precio, un dato de ese título.
    // Estuvieron invertidos (h1 en `text-h3`, precio en `text-h2`) y el precio
    // le ganaba al nombre — este caso existe para que no se revierta solo.
    const bike = makeBike({ price: 2500000 });
    render(<ProductInfo product={bike} colorSwatchIndex={EMPTY_SWATCH_INDEX} />);

    expect(screen.getByRole("heading", { name: "Verve+ 2" })).toHaveClass("text-h2");
    expect(screen.getByText("$25,000.00")).toHaveClass("text-h3");
  });

  it("excludes inactive variants from the color/size options", () => {
    const bike = makeBike({
      variants: [
        { sku: "SKU-RED", color: "Rojo", fulfillmentMode: "in_stock", isActive: true },
        { sku: "SKU-ARCHIVED", color: "Verde", fulfillmentMode: "in_stock", isActive: false },
      ],
    });
    render(<ProductInfo product={bike} colorSwatchIndex={EMPTY_SWATCH_INDEX} />);

    expect(screen.queryByRole("radio", { name: "Verde" })).not.toBeInTheDocument();
    // A single remaining active color still shows — it's product info, not a choice.
    expect(screen.getByRole("radio", { name: "Rojo" })).toBeInTheDocument();
  });

  describe("size preselection from a saved fit (A4)", () => {
    const SIZE_GUIDE: PublicSizeGuideEntry[] = [
      { value: "MD", minHeightCm: 160, maxHeightCm: 175 },
      { value: "LG", minHeightCm: 176, maxHeightCm: 190 },
    ];

    function makeBikeWithSizes(variants: PublicBike["variants"]): PublicBike {
      return makeBike({ variants });
    }

    it("preselects the recommended size and shows the suggestion note when it's available", () => {
      const bike = makeBikeWithSizes([
        { sku: "SKU-MD", size: "MD", fulfillmentMode: "in_stock", isActive: true },
        { sku: "SKU-LG", size: "LG", fulfillmentMode: "in_stock", isActive: true },
      ]);
      const fit: CustomerFit = { heightCm: 170, rideStyle: "balanced", gearSizes: [] };

      render(<ProductInfo product={bike} colorSwatchIndex={EMPTY_SWATCH_INDEX} sizeGuide={SIZE_GUIDE} fit={fit} />);

      expect(screen.getByRole("radio", { name: "MD" })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByText("Sugerida según tu perfil · cambiar")).toBeInTheDocument();
    });

    it("does not preselect anything when the recommended size is sold out", () => {
      const bike = makeBikeWithSizes([{ sku: "SKU-LG", size: "LG", fulfillmentMode: "in_stock", isActive: true }]);
      const fit: CustomerFit = { heightCm: 170, rideStyle: "balanced", gearSizes: [] };

      render(<ProductInfo product={bike} colorSwatchIndex={EMPTY_SWATCH_INDEX} sizeGuide={SIZE_GUIDE} fit={fit} />);

      expect(screen.queryByRole("radio", { checked: true })).not.toBeInTheDocument();
      expect(screen.queryByText("Sugerida según tu perfil · cambiar")).not.toBeInTheDocument();
    });

    it("does not preselect anything without a saved fit", () => {
      const bike = makeBikeWithSizes([{ sku: "SKU-MD", size: "MD", fulfillmentMode: "in_stock", isActive: true }]);

      render(<ProductInfo product={bike} colorSwatchIndex={EMPTY_SWATCH_INDEX} sizeGuide={SIZE_GUIDE} />);

      expect(screen.queryByRole("radio", { checked: true })).not.toBeInTheDocument();
      expect(screen.queryByText("Sugerida según tu perfil · cambiar")).not.toBeInTheDocument();
    });
  });
});
