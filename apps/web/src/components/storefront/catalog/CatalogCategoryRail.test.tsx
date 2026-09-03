import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicCategoryTreeNode } from "@bw-bikes/shared";
import { CatalogCategoryRail } from "./CatalogCategoryRail";

function makeCategory(overrides: Partial<PublicCategoryTreeNode> = {}): PublicCategoryTreeNode {
  return {
    id: `c-${Math.random()}`,
    name: "Carretera",
    slug: "carretera",
    parent: null,
    order: 0,
    usesSizes: true,
    image: { publicId: "p", url: "https://res.cloudinary.com/test/x.jpg", width: 800, height: 1000 },
    children: [],
    ...overrides,
  };
}

/** Same jsdom layout stubs as `CategoryCarousel.test.tsx` — `ScrollRail` reads real geometry that jsdom never computes. */
function stubLayout(): void {
  Element.prototype.getBoundingClientRect = vi.fn(() => ({
    width: 320,
    height: 400,
    top: 0,
    left: 0,
    right: 320,
    bottom: 400,
    x: 0,
    y: 0,
    toJSON: () => {},
  })) as unknown as () => DOMRect;
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 960 });
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, value: 2000 });
}

describe("CatalogCategoryRail", () => {
  it("links each card under /bicicletas for the bike catalog", () => {
    stubLayout();
    render(
      <CatalogCategoryRail
        catalog="bike"
        categories={[makeCategory({ name: "Montaña", slug: "montana" })]}
      />,
    );
    expect(screen.getByRole("link", { name: /Montaña/ })).toHaveAttribute("href", "/bicicletas/montana");
  });

  it("links each card under /accesorios for the accessory catalog", () => {
    stubLayout();
    render(
      <CatalogCategoryRail
        catalog="accessory"
        categories={[makeCategory({ name: "Cascos", slug: "cascos" })]}
      />,
    );
    expect(screen.getByRole("link", { name: /Cascos/ })).toHaveAttribute("href", "/accesorios/cascos");
  });

  it("marks the category matching activeSlug as the current page", () => {
    stubLayout();
    render(
      <CatalogCategoryRail
        catalog="bike"
        categories={[makeCategory({ name: "Montaña", slug: "montana" }), makeCategory({ name: "Ruta", slug: "ruta" })]}
        activeSlug="ruta"
      />,
    );
    expect(screen.getByRole("link", { name: /Ruta/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Montaña/ })).not.toHaveAttribute("aria-current");
  });

  it("always leads with a 'Todos' tile linking to the catalog root", () => {
    stubLayout();
    render(
      <CatalogCategoryRail
        catalog="bike"
        categories={[makeCategory({ name: "Montaña", slug: "montana" })]}
        activeSlug="montana"
      />,
    );
    const allLink = screen.getByRole("link", { name: /Todos/ });
    expect(allLink).toHaveAttribute("href", "/bicicletas");
    expect(allLink).not.toHaveAttribute("aria-current");
  });

  it("marks 'Todos' as current when no category is active", () => {
    stubLayout();
    render(<CatalogCategoryRail catalog="bike" categories={[makeCategory()]} />);
    expect(screen.getByRole("link", { name: /Todos/ })).toHaveAttribute("aria-current", "page");
  });
});
