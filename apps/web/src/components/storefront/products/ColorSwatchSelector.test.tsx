import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ColorSwatchSelector, type ColorOption } from "./ColorSwatchSelector";

const RED: ColorOption = { value: "Rojo", hex: "#c0392b", secondaryHex: null };
const BLUE: ColorOption = { value: "Azul", hex: "#2c3e50", secondaryHex: null };
const UNSET: ColorOption = { value: "Sin registrar", hex: null, secondaryHex: null };

describe("ColorSwatchSelector", () => {
  it("still renders the swatch and its name for a single color — nothing to choose between isn't nothing to show", () => {
    render(<ColorSwatchSelector colors={[RED]} selected="Rojo" onSelect={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "Rojo" })).toBeInTheDocument();
    expect(screen.getByText("Color")).toBeInTheDocument();
    expect(screen.getByText(": Rojo")).toBeInTheDocument();
  });

  it("renders nothing for zero colors", () => {
    const { container } = render(<ColorSwatchSelector colors={[]} selected={undefined} onSelect={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders one radio per color and marks the selected one", () => {
    render(<ColorSwatchSelector colors={[RED, BLUE]} selected="Rojo" onSelect={vi.fn()} />);

    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "Rojo" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Azul" })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onSelect with the clicked color's value", () => {
    const onSelect = vi.fn();
    render(<ColorSwatchSelector colors={[RED, BLUE]} selected="Rojo" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("radio", { name: "Azul" }));
    expect(onSelect).toHaveBeenCalledWith("Azul");
  });

  it("paints the swatch with the color's own hex — regression for the inline-span collapse bug", () => {
    render(<ColorSwatchSelector colors={[RED]} selected="Rojo" onSelect={vi.fn()} />);

    const swatch = screen.getByRole("radio", { name: "Rojo" }).querySelector("span[aria-hidden]");
    expect(swatch).toHaveClass("inline-block");
    expect(swatch).toHaveStyle({ backgroundColor: "#c0392b" });
  });

  it("falls back to the dashed placeholder ring when the color has no hex yet", () => {
    render(<ColorSwatchSelector colors={[UNSET]} selected="Sin registrar" onSelect={vi.fn()} />);

    const swatch = screen.getByRole("radio", { name: "Sin registrar" }).querySelector("span[aria-hidden]");
    expect(swatch).toHaveClass("border-dashed");
    expect(swatch).not.toHaveAttribute("style");
  });
});
