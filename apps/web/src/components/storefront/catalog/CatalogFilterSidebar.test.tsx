import type { PublicCatalogFilterOptions, PublicCategoryTreeNode } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/bicicletas",
  useSearchParams: () => new URLSearchParams("brand=specialized"),
}));

const { CatalogFilterSidebar } = await import("./CatalogFilterSidebar");

const CATEGORY_TREE: PublicCategoryTreeNode[] = [
  {
    id: "cat-1",
    name: "Montaña",
    slug: "montana",
    parent: null,
    order: 0,
    usesSizes: true,
    children: [{ id: "cat-1a", name: "Cross Country", slug: "xc", parent: "cat-1", order: 0, usesSizes: true }],
  },
];

const OPTIONS: PublicCatalogFilterOptions = {
  brands: [{ id: "brand-1", name: "Specialized", slug: "specialized", order: 0 }],
  sizes: ["M"],
  colors: [],
  price: null,
  specs: [],
};

describe("CatalogFilterSidebar", () => {
  it("is hidden below lg — CatalogFilterDrawer covers that range instead", () => {
    render(<CatalogFilterSidebar categoryTree={CATEGORY_TREE} options={OPTIONS} />);
    expect(screen.getByRole("complementary")).toHaveClass("hidden");
    expect(screen.getByRole("complementary")).toHaveClass("lg:block");
  });

  it("renders Categoría (roots) and Grupo (children) from the tree", () => {
    render(<CatalogFilterSidebar categoryTree={CATEGORY_TREE} options={OPTIONS} />);
    expect(screen.getByRole("button", { name: "Categoría" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Grupo" })).toBeInTheDocument();
  });

  it("does not render its own chip row — that lives in CatalogActiveFilters instead", () => {
    render(<CatalogFilterSidebar categoryTree={CATEGORY_TREE} options={OPTIONS} />);
    expect(screen.queryByRole("button", { name: "Limpiar filtros" })).not.toBeInTheDocument();
  });
});
