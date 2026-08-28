import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogFilterPriceRange } from "./CatalogFilterPriceRange";

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("CatalogFilterPriceRange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the current min/max as whole pesos", () => {
    render(<CatalogFilterPriceRange minPrice={100_000} maxPrice={500_000} bounds={null} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Desde")).toHaveValue(1000);
    expect(screen.getByLabelText("Hasta")).toHaveValue(5000);
  });

  it("uses the catalog's real bounds as placeholders when no value is set", () => {
    render(
      <CatalogFilterPriceRange
        minPrice={undefined}
        maxPrice={undefined}
        bounds={{ min: 50_000, max: 900_000 }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Desde")).toHaveAttribute("placeholder", "500");
    expect(screen.getByLabelText("Hasta")).toHaveAttribute("placeholder", "9000");
  });

  it("does not call onChange merely from mounting, even when the price carries centavos that round off", () => {
    const onChange = vi.fn();
    render(<CatalogFilterPriceRange minPrice={1999} maxPrice={undefined} bounds={null} onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("debounces typing before calling onChange, converting pesos to cents", async () => {
    const onChange = vi.fn();
    render(<CatalogFilterPriceRange minPrice={undefined} maxPrice={undefined} bounds={null} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "1000" } });
    expect(onChange).not.toHaveBeenCalled();

    await advance(500);
    expect(onChange).toHaveBeenCalledWith(100_000, undefined);
  });

  it("follows an external reset (e.g. 'Limpiar filtros') back to empty", () => {
    const { rerender } = render(
      <CatalogFilterPriceRange minPrice={100_000} maxPrice={500_000} bounds={null} onChange={vi.fn()} />,
    );
    rerender(<CatalogFilterPriceRange minPrice={undefined} maxPrice={undefined} bounds={null} onChange={vi.fn()} />);

    expect(screen.getByLabelText("Desde")).toHaveValue(null);
    expect(screen.getByLabelText("Hasta")).toHaveValue(null);
  });
});
