import type { PublicAccessory } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicColorSwatch } from "@/lib/api/public-catalog";
import { RelatedAccessories } from "./RelatedAccessories";

// `AddToCartButton`, rendered when an accessory resolves to exactly one
// active variant, needs a router and `CartProvider`.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/bicicletas/producto/x",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/cart/CartProvider", () => ({
  useCart: () => ({ addLine: vi.fn(), openDrawer: vi.fn() }),
}));
vi.mock("@/hooks/use-variant-availability", () => ({
  useVariantAvailability: () => ({ status: "ready", isSoldOut: () => false }),
}));

function makeAccessory(overrides: Partial<PublicAccessory> = {}): PublicAccessory {
  return {
    id: "acc-1",
    name: "Casco Aero",
    slug: "casco-aero",
    brand: { id: "brand-1", name: "Canyon", slug: "canyon", order: 0 },
    category: { id: "cat-1", name: "Cascos", slug: "cascos", parent: null, order: 0, usesSizes: false },
    badges: [],
    description: "Casco aerodinámico.",
    price: 199_990,
    currency: "MXN",
    variants: [{ sku: "SKU-1", color: "Negro", fulfillmentMode: "in_stock", isActive: true }],
    specGroups: [],
    gallery: [{ url: "https://example.com/casco.jpg", publicId: "casco", width: 800, height: 600, order: 0 }],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const EMPTY_SWATCH_INDEX = new Map<string, PublicColorSwatch>();

describe("RelatedAccessories", () => {
  it("renders nothing when there are no accessories", () => {
    const { container } = render(<RelatedAccessories accessories={[]} colorSwatchIndex={EMPTY_SWATCH_INDEX} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("drops accessories with no gallery image and renders nothing if none remain", () => {
    const accessory = makeAccessory({ gallery: [] });
    const { container } = render(<RelatedAccessories accessories={[accessory]} colorSwatchIndex={EMPTY_SWATCH_INDEX} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the heading, name, price, and a link to the accessory's own PDP", () => {
    render(<RelatedAccessories accessories={[makeAccessory()]} colorSwatchIndex={EMPTY_SWATCH_INDEX} />);

    expect(screen.getByRole("heading", { name: "Completa tu equipo" })).toBeInTheDocument();
    expect(screen.getByText("Casco Aero")).toBeInTheDocument();
    expect(screen.getByText("$1,999.90")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Casco Aero/ })).toHaveAttribute("href", "/accesorios/producto/casco-aero");
  });

  it("renders a real add-to-cart CTA named after its own accessory when it has a single active variant", () => {
    render(<RelatedAccessories accessories={[makeAccessory()]} colorSwatchIndex={EMPTY_SWATCH_INDEX} />);

    const cta = screen.getByRole("button", { name: "Agregar al carrito: Casco Aero" });
    expect(cta).toBeEnabled();
  });

  it("renders 'Ver opciones' when the accessory has more than one active variant", () => {
    const accessory = makeAccessory({
      variants: [
        { sku: "SKU-1", color: "Negro", fulfillmentMode: "in_stock", isActive: true },
        { sku: "SKU-2", color: "Blanco", fulfillmentMode: "in_stock", isActive: true },
      ],
    });
    render(<RelatedAccessories accessories={[accessory]} colorSwatchIndex={EMPTY_SWATCH_INDEX} />);

    const cta = screen.getByRole("link", { name: "Ver opciones: Casco Aero" });
    expect(cta).toHaveAttribute("href", "/accesorios/producto/casco-aero");
  });

  it("caps visible color swatches and shows a +N overflow count", () => {
    const accessory = makeAccessory({
      variants: ["Negro", "Blanco", "Rojo", "Azul", "Verde"].map((color, index) => ({
        sku: `SKU-${index}`,
        color,
        fulfillmentMode: "in_stock",
        isActive: true,
      })),
    });
    render(<RelatedAccessories accessories={[accessory]} colorSwatchIndex={EMPTY_SWATCH_INDEX} />);

    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.getByText("Colores: Negro, Blanco, Rojo, Azul, Verde")).toBeInTheDocument();
  });
});
