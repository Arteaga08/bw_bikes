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

const { CatalogFilterDrawer } = await import("./CatalogFilterDrawer");

const CATEGORY_TREE: PublicCategoryTreeNode[] = [
  { id: "cat-1", name: "Montaña", slug: "montana", parent: null, order: 0, usesSizes: true, children: [] },
];

const OPTIONS: PublicCatalogFilterOptions = {
  brands: [{ id: "brand-1", name: "Specialized", slug: "specialized", order: 0 }],
  sizes: ["M", "L"],
  colors: [],
  price: { min: 100_000, max: 500_000 },
  specs: [],
};

describe("CatalogFilterDrawer", () => {
  it("starts closed, with the panel inert", () => {
    render(<CatalogFilterDrawer categoryTree={CATEGORY_TREE} options={OPTIONS} />);
    expect(screen.getByRole("dialog", { hidden: true })).toHaveAttribute("inert", "");
  });

  it("shows the active-filter count on the trigger when the URL already carries filters", () => {
    useSearchParamsMock.mockReturnValueOnce(new URLSearchParams("brand=specialized&size=M"));
    render(<CatalogFilterDrawer categoryTree={CATEGORY_TREE} options={OPTIONS} />);
    expect(screen.getByRole("button", { name: "Filtros (2)" })).toBeInTheDocument();
  });

  it("opens on trigger click, entering from the right", () => {
    render(<CatalogFilterDrawer categoryTree={CATEGORY_TREE} options={OPTIONS} />);
    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).not.toHaveAttribute("inert");
    expect(dialog).toHaveClass("right-0");
    expect(dialog).toHaveClass("translate-x-0");
    expect(dialog).not.toHaveClass("translate-x-full");
  });

  it("closes on the close button", () => {
    render(<CatalogFilterDrawer categoryTree={CATEGORY_TREE} options={OPTIONS} />);
    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar filtros" }));

    expect(screen.getByRole("dialog", { hidden: true })).toHaveAttribute("inert", "");
  });

  it("closes on Escape", () => {
    render(<CatalogFilterDrawer categoryTree={CATEGORY_TREE} options={OPTIONS} />);
    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByRole("dialog", { hidden: true })).toHaveAttribute("inert", "");
  });

  it("closes from 'Ver resultados'", () => {
    render(<CatalogFilterDrawer categoryTree={CATEGORY_TREE} options={OPTIONS} />);
    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver resultados" }));

    expect(screen.getByRole("dialog", { hidden: true })).toHaveAttribute("inert", "");
  });

  it("renders the same filter groups the sidebar would, and checking one writes the URL", () => {
    render(<CatalogFilterDrawer categoryTree={CATEGORY_TREE} options={OPTIONS} />);
    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));

    fireEvent.click(screen.getByRole("checkbox", { name: "Specialized" }));
    expect(replaceMock).toHaveBeenCalledWith("/bicicletas?brand=specialized", { scroll: false });
  });
});
