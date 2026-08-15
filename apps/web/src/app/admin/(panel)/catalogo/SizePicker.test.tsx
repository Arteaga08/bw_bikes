import type { SizeTemplate } from "@bw-bikes/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SizePicker } from "./SizePicker";
import { emptyVariantRow, type VariantRow } from "./VariantsEditor";

function template(overrides: Partial<SizeTemplate> = {}): SizeTemplate {
  return { id: "size-1", value: "54", source: "manual", order: 0, isActive: true, ...overrides };
}

function row(overrides: Partial<VariantRow> = {}): VariantRow {
  return { ...emptyVariantRow(), ...overrides };
}

describe("SizePicker", () => {
  it("checking a chip creates its first variant row", () => {
    const onChange = vi.fn();
    render(<SizePicker sizeTemplates={[template({ value: "54" })]} variants={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "54" }));

    expect(onChange).toHaveBeenCalledWith([{ ...emptyVariantRow(), size: "54" }]);
  });

  it("unchecking a chip with no captured SKU removes its rows without asking", () => {
    const onChange = vi.fn();
    const variants = [row({ size: "54" })];
    render(<SizePicker sizeTemplates={[template({ value: "54" })]} variants={variants} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "54" }));

    expect(onChange).toHaveBeenCalledWith([]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("unchecking a chip with a captured SKU asks for confirmation instead of removing it right away", () => {
    const onChange = vi.fn();
    const variants = [row({ size: "54", sku: "BK-54" })];
    render(<SizePicker sizeTemplates={[template({ value: "54" })]} variants={variants} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "54" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/ya tiene SKU capturado/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sí, quitar" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("cancelling the confirmation keeps the size and its rows untouched", () => {
    const onChange = vi.fn();
    const variants = [row({ size: "54", sku: "BK-54" })];
    render(<SizePicker sizeTemplates={[template({ value: "54" })]} variants={variants} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "54" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("adds a size typed in 'Nueva talla' that isn't in the catalog yet", () => {
    const onChange = vi.fn();
    render(<SizePicker sizeTemplates={[]} variants={[]} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Nueva talla"), { target: { value: "38 EU" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar talla" }));

    expect(onChange).toHaveBeenCalledWith([{ ...emptyVariantRow(), size: "38 EU" }]);
  });

  it("adds the typed size on Enter without submitting a form", () => {
    const onChange = vi.fn();
    render(<SizePicker sizeTemplates={[]} variants={[]} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Nueva talla"), { target: { value: "M" } });
    fireEvent.keyDown(screen.getByLabelText("Nueva talla"), { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith([{ ...emptyVariantRow(), size: "M" }]);
  });

  it("shows a chip for a size already on a variant even when it's not in the catalog", () => {
    render(<SizePicker sizeTemplates={[]} variants={[row({ size: "40 EU" })]} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "40 EU" })).toHaveAttribute("aria-pressed", "true");
  });
});
