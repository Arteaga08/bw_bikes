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
  it("shows a placeholder instead of any group when there are no variants yet", () => {
    render(<VariantsEditor variants={[]} onChange={vi.fn()} />);
    expect(screen.getByText("Elige una talla arriba para empezar a capturar variantes.")).toBeInTheDocument();
  });

  it("groups rows under their size instead of repeating a 'Talla' field", () => {
    const variants = [row({ size: "54", sku: "A" }), row({ size: "M", sku: "B" })];
    render(<VariantsEditor variants={variants} onChange={vi.fn()} />);

    expect(screen.getByText("54")).toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.queryByLabelText("Talla")).not.toBeInTheDocument();
  });

  it("labels a variant with no size 'Sin talla' instead of an empty heading", () => {
    render(<VariantsEditor variants={[row({ size: "" })]} onChange={vi.fn()} />);
    expect(screen.getByText("Sin talla")).toBeInTheDocument();
  });

  it("shows a duplicate-SKU error on both rows once two variants collide, even across different sizes", () => {
    const variants = [row({ size: "54", sku: "BK-DUP" }), row({ size: "M", sku: "BK-DUP" })];
    render(<VariantsEditor variants={variants} onChange={vi.fn()} />);

    expect(screen.getAllByText("SKU repetido entre variantes.")).toHaveLength(2);
  });

  it("does not show the duplicate error when SKUs are unique", () => {
    const variants = [row({ size: "54", sku: "BK-A" }), row({ size: "54", sku: "BK-B" })];
    render(<VariantsEditor variants={variants} onChange={vi.fn()} />);

    expect(screen.queryByText("SKU repetido entre variantes.")).not.toBeInTheDocument();
  });

  it("only shows the estimated-date field when fulfillmentMode is preorder", () => {
    const { rerender } = render(
      <VariantsEditor variants={[row({ size: "54", fulfillmentMode: "in_stock" })]} onChange={vi.fn()} />,
    );
    expect(screen.queryByLabelText("Fecha estimada")).not.toBeInTheDocument();

    rerender(<VariantsEditor variants={[row({ size: "54", fulfillmentMode: "preorder" })]} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Fecha estimada")).toBeInTheDocument();
  });

  it("adds a new row under the same size on 'Agregar variante en esta talla'", () => {
    const onChange = vi.fn();
    render(<VariantsEditor variants={[row({ size: "54" })]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Agregar variante en esta talla" }));

    expect(onChange).toHaveBeenCalledWith([row({ size: "54" }), { ...emptyVariantRow(), size: "54" }]);
  });

  it("uppercases the SKU as it's typed", () => {
    const onChange = vi.fn();
    render(<VariantsEditor variants={[row({ size: "54", sku: "" })]} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("SKU"), { target: { value: "bk-tarmac-m" } });

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ sku: "BK-TARMAC-M" })]);
  });

  it("removes only the clicked row, not the whole size group", () => {
    const onChange = vi.fn();
    const variants = [row({ size: "54", sku: "A" }), row({ size: "54", sku: "B" })];
    render(<VariantsEditor variants={variants} onChange={onChange} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Eliminar variante" })[0]!);

    expect(onChange).toHaveBeenCalledWith([variants[1]]);
  });

  describe("sizeless (category doesn't manage sizes)", () => {
    it("shows an 'Agregar variante' button instead of the 'elige una talla' placeholder when there are no variants yet", () => {
      render(<VariantsEditor variants={[]} onChange={vi.fn()} sizeless />);
      expect(screen.getByRole("button", { name: "Agregar variante" })).toBeInTheDocument();
      expect(screen.queryByText("Elige una talla arriba para empezar a capturar variantes.")).not.toBeInTheDocument();
    });

    it("adds a row with an empty size on click", () => {
      const onChange = vi.fn();
      render(<VariantsEditor variants={[]} onChange={onChange} sizeless />);

      fireEvent.click(screen.getByRole("button", { name: "Agregar variante" }));

      expect(onChange).toHaveBeenCalledWith([{ ...emptyVariantRow(), size: "" }]);
    });

    it("still shows the original placeholder when sizeless is false (default), no regression", () => {
      render(<VariantsEditor variants={[]} onChange={vi.fn()} />);
      expect(screen.getByText("Elige una talla arriba para empezar a capturar variantes.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Agregar variante" })).not.toBeInTheDocument();
    });
  });
});
