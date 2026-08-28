import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CatalogFilterCheckboxList } from "./CatalogFilterCheckboxList";

const OPTIONS = Array.from({ length: 7 }, (_, index) => ({ value: `v${index}`, label: `Opción ${index}` }));

describe("CatalogFilterCheckboxList", () => {
  it("renders nothing for an empty options list", () => {
    const { container } = render(<CatalogFilterCheckboxList options={[]} selected={[]} onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows only the first 5 options, with a 'Ver más' toggle for the rest", () => {
    render(<CatalogFilterCheckboxList options={OPTIONS} selected={[]} onChange={vi.fn()} />);

    for (let i = 0; i < 5; i += 1) expect(screen.getByRole("checkbox", { name: `Opción ${i}` })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Opción 5" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver más (2)" })).toBeInTheDocument();
  });

  it("reveals every option after clicking 'Ver más', and can collapse back", () => {
    render(<CatalogFilterCheckboxList options={OPTIONS} selected={[]} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Ver más (2)" }));
    expect(screen.getByRole("checkbox", { name: "Opción 6" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver menos" }));
    expect(screen.queryByRole("checkbox", { name: "Opción 6" })).not.toBeInTheDocument();
  });

  it("omits the toggle when there are 5 or fewer options", () => {
    render(<CatalogFilterCheckboxList options={OPTIONS.slice(0, 5)} selected={[]} onChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Ver más/ })).not.toBeInTheDocument();
  });

  it("reflects the selected values as checked", () => {
    render(<CatalogFilterCheckboxList options={OPTIONS} selected={["v1"]} onChange={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: "Opción 1" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Opción 0" })).not.toBeChecked();
  });

  it("adds a value on check and removes it on uncheck", () => {
    const onChange = vi.fn();
    const { rerender } = render(<CatalogFilterCheckboxList options={OPTIONS} selected={["v1"]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Opción 0" }));
    expect(onChange).toHaveBeenLastCalledWith(["v1", "v0"]);

    rerender(<CatalogFilterCheckboxList options={OPTIONS} selected={["v1"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Opción 1" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
