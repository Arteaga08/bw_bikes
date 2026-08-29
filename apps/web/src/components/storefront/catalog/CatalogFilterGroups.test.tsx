import type { PublicCatalogFilterOptions, PublicCategoryTreeNode } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useSearchParamsMock = vi.hoisted(() => vi.fn(() => new URLSearchParams()));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/bicicletas",
  useSearchParams: useSearchParamsMock,
}));

const { CatalogFilterGroups } = await import("./CatalogFilterGroups");

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
  specs: [{ label: "Material", values: ["Carbono", "Aluminio"] }],
};

describe("CatalogFilterGroups", () => {
  it("renders Categoría by default, with Grupo absent until a category is selected", () => {
    render(<CatalogFilterGroups categoryTree={CATEGORY_TREE} options={OPTIONS} />);
    expect(screen.getByRole("button", { name: "Categoría" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Grupo" })).not.toBeInTheDocument();
  });

  it("shows Grupo, expanded, with the selected category's own children once it's checked", () => {
    useSearchParamsMock.mockReturnValueOnce(new URLSearchParams("category=cat-1"));
    render(<CatalogFilterGroups categoryTree={CATEGORY_TREE} options={OPTIONS} />);

    const grupo = screen.getByRole("button", { name: "Grupo" });
    expect(grupo).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("checkbox", { name: "Cross Country" })).toBeInTheDocument();
  });

  it("hides Categoría and Grupo when hideCategoryFilter is set — a /[slug] page already fixes the category via its route", () => {
    render(<CatalogFilterGroups categoryTree={CATEGORY_TREE} options={OPTIONS} hideCategoryFilter />);
    expect(screen.queryByRole("button", { name: "Categoría" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Grupo" })).not.toBeInTheDocument();
  });

  it("still renders every other group when hideCategoryFilter is set", () => {
    render(<CatalogFilterGroups categoryTree={CATEGORY_TREE} options={OPTIONS} hideCategoryFilter />);
    expect(screen.getByRole("button", { name: "Marca" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Talla" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Precio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Destacados" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Material" })).toBeInTheDocument();
  });
});
