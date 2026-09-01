import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicColorSwatch, PublicProductSummary } from "@/lib/api/public-catalog";
import { CatalogProductGrid } from "./CatalogProductGrid";

// `SaveButton`, embedded in every `CatalogProductCard` (A5-guardados.md), needs a router and `WishlistProvider`.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/bicicletas" }));
vi.mock("@/components/storefront/WishlistProvider", () => ({
  useWishlist: () => ({ isSignedIn: true, isSaved: () => false, toggle: vi.fn() }),
}));

function makeProduct(overrides: Partial<PublicProductSummary> = {}): PublicProductSummary {
  return {
    id: `p-${Math.random()}`,
    slug: "producto",
    kind: "bike",
    name: "Producto",
    brand: { id: "b1", name: "Marca", slug: "marca", order: 0 },
    price: 100_00,
    badges: [],
    colors: [],
    gallery: [{ publicId: "img", url: "https://res.cloudinary.com/test/a.jpg", width: 800, height: 600, order: 0 }],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const emptySwatchIndex = new Map<string, PublicColorSwatch>();

describe("CatalogProductGrid", () => {
  it("renders one tile per product", () => {
    render(
      <CatalogProductGrid
        products={[makeProduct({ name: "Uno" }), makeProduct({ name: "Dos" }), makeProduct({ name: "Tres" })]}
        colorSwatchIndex={emptySwatchIndex}
        emptyMessage="Sin productos."
      />,
    );
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("renders the empty message instead of a grid when there are no products", () => {
    render(<CatalogProductGrid products={[]} colorSwatchIndex={emptySwatchIndex} emptyMessage="No hay productos aquí." />);
    expect(screen.getByText("No hay productos aquí.")).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("applies its own page gutter by default", () => {
    render(<CatalogProductGrid products={[makeProduct()]} colorSwatchIndex={emptySwatchIndex} emptyMessage="" />);
    expect(screen.getByRole("link").closest(".grid")).toHaveClass("px-lg");
  });

  it("omits its own gutter when a parent already provides one (noGutter)", () => {
    render(<CatalogProductGrid products={[makeProduct()]} colorSwatchIndex={emptySwatchIndex} emptyMessage="" noGutter />);
    expect(screen.getByRole("link").closest(".grid")).not.toHaveClass("px-lg");
  });

  it("omits the gutter on the empty state too when noGutter is set", () => {
    render(<CatalogProductGrid products={[]} colorSwatchIndex={emptySwatchIndex} emptyMessage="Vacío." noGutter />);
    expect(screen.getByText("Vacío.")).not.toHaveClass("px-lg");
  });
});
