import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CatalogFilterChips } from "./CatalogFilterChips";

describe("CatalogFilterChips", () => {
  it("renders nothing when there are no active filters", () => {
    const { container } = render(<CatalogFilterChips chips={[]} onRemove={vi.fn()} onClearAll={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders one removable chip per active filter, plus 'Limpiar filtros'", () => {
    const chips = [
      { key: "brand:specialized", label: "Specialized" },
      { key: "size:M", label: "Talla M" },
    ];
    render(<CatalogFilterChips chips={chips} onRemove={vi.fn()} onClearAll={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Quitar filtro Specialized" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quitar filtro Talla M" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Limpiar filtros" })).toBeInTheDocument();
  });

  it("removes exactly the clicked chip's key", () => {
    const onRemove = vi.fn();
    const chips = [{ key: "brand:specialized", label: "Specialized" }];
    render(<CatalogFilterChips chips={chips} onRemove={onRemove} onClearAll={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Quitar filtro Specialized" }));
    expect(onRemove).toHaveBeenCalledWith("brand:specialized");
  });

  it("calls onClearAll from the 'Limpiar filtros' control", () => {
    const onClearAll = vi.fn();
    const chips = [{ key: "brand:specialized", label: "Specialized" }];
    render(<CatalogFilterChips chips={chips} onRemove={vi.fn()} onClearAll={onClearAll} />);

    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(onClearAll).toHaveBeenCalledOnce();
  });
});
