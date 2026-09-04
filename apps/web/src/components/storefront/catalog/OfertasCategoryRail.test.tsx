import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicCategoryTreeNode } from "@bw-bikes/shared";
import { OfertasCategoryRail } from "./OfertasCategoryRail";

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

/** Same jsdom layout stubs as `CatalogCategoryRail.test.tsx` — `ScrollRail` reads real geometry that jsdom never computes. */
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

describe("OfertasCategoryRail", () => {
  it("renders bike categories before accessory categories, each linking to its ofertas-filtered results", () => {
    stubLayout();
    render(
      <OfertasCategoryRail
        bikeCategories={[makeCategory({ id: "bike-1", name: "Montaña", slug: "montana" })]}
        accessoryCategories={[makeCategory({ id: "acc-1", name: "Cascos", slug: "cascos" })]}
      />,
    );

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Montaña", "Cascos"]);
    expect(screen.getByRole("link", { name: /Montaña/ })).toHaveAttribute("href", "/ofertas?category=bike-1");
    expect(screen.getByRole("link", { name: /Cascos/ })).toHaveAttribute("href", "/ofertas?category=acc-1");
  });

  it("renders no 'Todos' tile", () => {
    stubLayout();
    render(
      <OfertasCategoryRail
        bikeCategories={[makeCategory({ name: "Montaña", slug: "montana" })]}
        accessoryCategories={[]}
      />,
    );

    expect(screen.queryByRole("link", { name: /Todos/ })).not.toBeInTheDocument();
  });
});
