import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { emptyVariantRow, findDuplicateSkuIndices, VariantsEditor, type VariantRow } from "./VariantsEditor";

function row(overrides: Partial<VariantRow> = {}): VariantRow {
  return { ...emptyVariantRow(), ...overrides };
}

describe("findDuplicateSkuIndices", () => {
  it("flags both rows sharing a SKU, case- and trim-insensitive", () => {
    const variants = [row({ sku: "bk-tarmac-m " }), row({ sku: "BK-TARMAC-M" }), row({ sku: "BK-OTHER" })];
    expect(findDuplicateSkuIndices(variants)).toEqual(new Set([0, 1]));
  });

  it("ignores empty SKUs — an unfinished row isn't a duplicate of another unfinished row", () => {
    expect(findDuplicateSkuIndices([row({ sku: "" }), row({ sku: "" })])).toEqual(new Set());
  });

  it("returns an empty set when every SKU is unique", () => {
    expect(findDuplicateSkuIndices([row({ sku: "A" }), row({ sku: "B" })])).toEqual(new Set());
  });
});

describe("VariantsEditor", () => {
  it("shows a duplicate-SKU error on both rows once two variants collide", () => {
    const variants = [row({ sku: "BK-DUP" }), row({ sku: "BK-DUP" })];
    render(<VariantsEditor variants={variants} onChange={vi.fn()} />);

    expect(screen.getAllByText("SKU repetido entre variantes.")).toHaveLength(2);
  });

  it("does not show the duplicate error when SKUs are unique", () => {
    const variants = [row({ sku: "BK-A" }), row({ sku: "BK-B" })];
    render(<VariantsEditor variants={variants} onChange={vi.fn()} />);

    expect(screen.queryByText("SKU repetido entre variantes.")).not.toBeInTheDocument();
  });

  it("only shows the estimated-date field when fulfillmentMode is preorder", () => {
    const { rerender } = render(<VariantsEditor variants={[row({ fulfillmentMode: "in_stock" })]} onChange={vi.fn()} />);
    expect(screen.queryByLabelText("Fecha estimada")).not.toBeInTheDocument();

    rerender(<VariantsEditor variants={[row({ fulfillmentMode: "preorder" })]} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Fecha estimada")).toBeInTheDocument();
  });

  it("adds a new empty row on 'Agregar variante'", () => {
    const onChange = vi.fn();
    render(<VariantsEditor variants={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Agregar variante" }));

    expect(onChange).toHaveBeenCalledWith([emptyVariantRow()]);
  });

  it("uppercases the SKU as it's typed", () => {
    const onChange = vi.fn();
    render(<VariantsEditor variants={[row({ sku: "" })]} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("SKU"), { target: { value: "bk-tarmac-m" } });

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ sku: "BK-TARMAC-M" })]);
  });
});
