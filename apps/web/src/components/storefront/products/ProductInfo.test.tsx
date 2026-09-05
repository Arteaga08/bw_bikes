import type { CustomerFit, PublicBike, PublicSizeGuideEntry } from "@bw-bikes/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicColorSwatch } from "@/lib/api/public-catalog";
import { ProductInfo } from "./ProductInfo";

// `SaveButton` and `AddToCartButton`, embedded next to the buy CTA, need a
// router, `WishlistProvider`, `CartProvider` and the availability hook.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/bicicletas/producto/x",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/storefront/WishlistProvider", () => ({
  useWishlist: () => ({ isSignedIn: true, isSaved: () => false, toggle: vi.fn() }),
}));
vi.mock("@/components/cart/CartProvider", () => ({
  useCart: () => ({ addLine: vi.fn(), openDrawer: vi.fn() }),
}));
vi.mock("@/hooks/use-variant-availability", () => ({
  useVariantAvailability: () => ({ status: "ready", isSoldOut: () => false }),
}));
const { useCustomerFitMock } = vi.hoisted(() => ({
  useCustomerFitMock: vi.fn<() => import("@bw-bikes/shared").CustomerFit | undefined>(() => undefined),
}));
vi.mock("@/hooks/use-customer-fit", () => ({ useCustomerFit: useCustomerFitMock }));

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
  beforeEach(() => {
    useCustomerFitMock.mockReturnValue(undefined);
  });

  it("shows the base price and no color/size selectors for a single-variant product", () => {
    const bike = makeBike({
      variants: [{ sku: "SKU-1", fulfillmentMode: "in_stock", isActive: true }],
    });
    render(<ProductInfo product={bike} itemType="bike" colorSwatchIndex={EMPTY_SWATCH_INDEX} />);

    expect(screen.getByText("$25,000.00")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Color" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Talla" })).not.toBeInTheDocument();
  });

  it("strips the brand from the name and disables the CTA until a variant is selected", () => {
    const bike = makeBike();
    render(<ProductInfo product={bike} itemType="bike" colorSwatchIndex={EMPTY_SWATCH_INDEX} />);

    expect(screen.getByRole("heading", { name: "Verve+ 2" })).toBeInTheDocument();
    const cta = screen.getByRole("button", { name: "Selecciona una talla" });
    expect(cta).toBeDisabled();
  });

  it("pre-selects the first color and shows only sizes matching it as available", () => {
    const bike = makeBike({
      variants: [
        { sku: "SKU-RED-MD", color: "Rojo", size: "MD", fulfillmentMode: "in_stock", isActive: true },
        { sku: "SKU-BLUE-LG", color: "Azul", size: "LG", fulfillmentMode: "in_stock", isActive: true },
      ],
    });
    render(<ProductInfo product={bike} itemType="bike" colorSwatchIndex={EMPTY_SWATCH_INDEX} />);

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
    render(<ProductInfo product={bike} itemType="bike" colorSwatchIndex={EMPTY_SWATCH_INDEX} />);

    expect(screen.getByText("$25,000.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "LG" }));
    expect(screen.getByText("$27,000.00")).toBeInTheDocument();
  });

  it("keeps the product name a step above the price in the type scale", () => {
    // El nombre es el título de la página; el precio, un dato de ese título.
    // Estuvieron invertidos (h1 en `text-h3`, precio en `text-h2`) y el precio
    // le ganaba al nombre — este caso existe para que no se revierta solo.
    const bike = makeBike({ price: 2500000 });
    render(<ProductInfo product={bike} itemType="bike" colorSwatchIndex={EMPTY_SWATCH_INDEX} />);

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
    render(<ProductInfo product={bike} itemType="bike" colorSwatchIndex={EMPTY_SWATCH_INDEX} />);

    expect(screen.queryByRole("radio", { name: "Verde" })).not.toBeInTheDocument();
    // A single remaining active color still shows — it's product info, not a choice.
    expect(screen.getByRole("radio", { name: "Rojo" })).toBeInTheDocument();
  });

  describe("size recommendation from a saved fit (A4)", () => {
    const SIZE_GUIDE: PublicSizeGuideEntry[] = [
      { value: "MD", minHeightCm: 160, maxHeightCm: 175 },
      { value: "LG", minHeightCm: 176, maxHeightCm: 190 },
    ];

    function makeBikeWithSizes(variants: PublicBike["variants"]): PublicBike {
      return makeBike({ variants });
    }

    // `fit` now arrives from `useCustomerFit` — a client-side fetch, not a
    // server-passed prop (M-optimización) — so it can no longer *preselect*
    // a radio without risking either a blank-then-jump on first paint or
    // silently overwriting a size the shopper already clicked while the
    // fetch was in flight. It's informational only now: never sets
    // `selectedSize`, only ever shows a note next to the selector.
    it("never auto-selects a radio, but shows the recommendation note when a fit is available", () => {
      useCustomerFitMock.mockReturnValue({ heightCm: 170, rideStyle: "balanced", gearSizes: [] } satisfies CustomerFit);
      const bike = makeBikeWithSizes([
        { sku: "SKU-MD", size: "MD", fulfillmentMode: "in_stock", isActive: true },
        { sku: "SKU-LG", size: "LG", fulfillmentMode: "in_stock", isActive: true },
      ]);

      render(<ProductInfo product={bike} itemType="bike" colorSwatchIndex={EMPTY_SWATCH_INDEX} sizeGuide={SIZE_GUIDE} />);

      expect(screen.queryByRole("radio", { checked: true })).not.toBeInTheDocument();
      expect(screen.getByText("Tu talla recomendada para esta bici es MD.")).toBeInTheDocument();
    });

    it("hides the recommendation note once the shopper picks that exact size themselves", () => {
      useCustomerFitMock.mockReturnValue({ heightCm: 170, rideStyle: "balanced", gearSizes: [] } satisfies CustomerFit);
      const bike = makeBikeWithSizes([
        { sku: "SKU-MD", size: "MD", fulfillmentMode: "in_stock", isActive: true },
        { sku: "SKU-LG", size: "LG", fulfillmentMode: "in_stock", isActive: true },
      ]);

      render(<ProductInfo product={bike} itemType="bike" colorSwatchIndex={EMPTY_SWATCH_INDEX} sizeGuide={SIZE_GUIDE} />);
      fireEvent.click(screen.getByRole("radio", { name: "MD" }));

      expect(screen.queryByText("Tu talla recomendada para esta bici es MD.")).not.toBeInTheDocument();
    });

    it("shows no recommendation when the recommended size is sold out", () => {
      useCustomerFitMock.mockReturnValue({ heightCm: 170, rideStyle: "balanced", gearSizes: [] } satisfies CustomerFit);
      const bike = makeBikeWithSizes([{ sku: "SKU-LG", size: "LG", fulfillmentMode: "in_stock", isActive: true }]);

      render(<ProductInfo product={bike} itemType="bike" colorSwatchIndex={EMPTY_SWATCH_INDEX} sizeGuide={SIZE_GUIDE} />);

      expect(screen.queryByRole("radio", { checked: true })).not.toBeInTheDocument();
      expect(screen.queryByText(/Tu talla recomendada/)).not.toBeInTheDocument();
    });

    it("shows no recommendation without a saved fit", () => {
      useCustomerFitMock.mockReturnValue(undefined);
      const bike = makeBikeWithSizes([{ sku: "SKU-MD", size: "MD", fulfillmentMode: "in_stock", isActive: true }]);

      render(<ProductInfo product={bike} itemType="bike" colorSwatchIndex={EMPTY_SWATCH_INDEX} sizeGuide={SIZE_GUIDE} />);

      expect(screen.queryByRole("radio", { checked: true })).not.toBeInTheDocument();
      expect(screen.queryByText(/Tu talla recomendada/)).not.toBeInTheDocument();
    });
  });
});
