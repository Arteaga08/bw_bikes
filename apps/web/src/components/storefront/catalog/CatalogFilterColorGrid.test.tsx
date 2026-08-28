import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CatalogFilterColorGrid } from "./CatalogFilterColorGrid";

const OPTIONS = Array.from({ length: 8 }, (_, index) => ({
  value: `Color ${index}`,
  hex: index % 2 === 0 ? "#111111" : null,
  secondaryHex: null,
}));

describe("CatalogFilterColorGrid", () => {
  it("renders nothing for an empty options list", () => {
    const { container } = render(<CatalogFilterColorGrid options={[]} selected={[]} onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows only the first 6 colors, with a 'Ver más' toggle for the rest", () => {
    render(<CatalogFilterColorGrid options={OPTIONS} selected={[]} onChange={vi.fn()} />);

    for (let i = 0; i < 6; i += 1) expect(screen.getByRole("checkbox", { name: `Color ${i}` })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Color 6" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver más (2)" })).toBeInTheDocument();
  });

  it("reveals every color after clicking 'Ver más'", () => {
    render(<CatalogFilterColorGrid options={OPTIONS} selected={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver más (2)" }));
    expect(screen.getByRole("checkbox", { name: "Color 7" })).toBeInTheDocument();
  });

  it("reflects a selected color as checked", () => {
    render(<CatalogFilterColorGrid options={OPTIONS} selected={["Color 1"]} onChange={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: "Color 1" })).toBeChecked();
  });

  it("toggles a color in and out of the selection", () => {
    const onChange = vi.fn();
    render(<CatalogFilterColorGrid options={OPTIONS} selected={["Color 1"]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Color 0" }));
    expect(onChange).toHaveBeenCalledWith(["Color 1", "Color 0"]);
  });
});
