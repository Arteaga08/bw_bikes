import type { PublicCatalogFilterOptions, PublicCategoryTreeNode } from "@bw-bikes/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { replaceMock, useSearchParamsMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  useSearchParamsMock: vi.fn(() => new URLSearchParams()),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/bicicletas",
  useSearchParams: useSearchParamsMock,
}));

const { CatalogActiveFilters } = await import("./CatalogActiveFilters");

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

describe("CatalogActiveFilters", () => {
  it("renders nothing when no filter is active", () => {
    const { container } = render(<CatalogActiveFilters categoryTree={CATEGORY_TREE} options={OPTIONS} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("resolves a category id in the URL to its display name", () => {
    useSearchParamsMock.mockReturnValueOnce(new URLSearchParams("category=cat-1a"));
    render(<CatalogActiveFilters categoryTree={CATEGORY_TREE} options={OPTIONS} />);
    expect(screen.getByRole("button", { name: "Quitar filtro Cross Country" })).toBeInTheDocument();
  });

  it("resolves a brand slug in the URL to its display name", () => {
    useSearchParamsMock.mockReturnValueOnce(new URLSearchParams("brand=specialized"));
    render(<CatalogActiveFilters categoryTree={CATEGORY_TREE} options={OPTIONS} />);
    expect(screen.getByRole("button", { name: "Quitar filtro Specialized" })).toBeInTheDocument();
  });

  it("removes one filter without touching the others", () => {
    useSearchParamsMock.mockReturnValueOnce(new URLSearchParams("brand=specialized&size=M"));
    render(<CatalogActiveFilters categoryTree={CATEGORY_TREE} options={OPTIONS} />);

    fireEvent.click(screen.getByRole("button", { name: "Quitar filtro Specialized" }));
    expect(replaceMock).toHaveBeenCalledWith("/bicicletas?size=M", { scroll: false });
  });

  it("clears every filter from 'Limpiar filtros'", () => {
    useSearchParamsMock.mockReturnValueOnce(new URLSearchParams("brand=specialized&size=M"));
    render(<CatalogActiveFilters categoryTree={CATEGORY_TREE} options={OPTIONS} />);

    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(replaceMock).toHaveBeenCalledWith("/bicicletas", { scroll: false });
  });

  // Sort isn't a filter — it has no chip here and no CatalogSortMenu selection
  // should vanish just because the shopper cleared brand/size.
  it("keeps the active sort when clearing every filter", () => {
    useSearchParamsMock.mockReturnValueOnce(new URLSearchParams("brand=specialized&size=M&sort=price"));
    render(<CatalogActiveFilters categoryTree={CATEGORY_TREE} options={OPTIONS} />);

    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(replaceMock).toHaveBeenCalledWith("/bicicletas?sort=price", { scroll: false });
  });
});
