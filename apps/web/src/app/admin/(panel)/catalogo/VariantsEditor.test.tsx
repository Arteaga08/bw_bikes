import type { ColorTemplate } from "@bw-bikes/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { emptyVariantRow, findDuplicateSkuIndices, VariantsEditor, type VariantRow } from "./VariantsEditor";

function row(overrides: Partial<VariantRow> = {}): VariantRow {
  return { ...emptyVariantRow(), ...overrides };
}

function colorTemplate(overrides: Partial<ColorTemplate> = {}): ColorTemplate {
  return { id: "ct-1", value: "Negro", hex: "#0A0A0A", secondaryHex: null, source: "manual", order: 0, isActive: true, ...overrides };
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
    render(<VariantsEditor variants={[]} onChange={vi.fn()} mode="edit" />);
    expect(screen.getByText("Elige una talla arriba para empezar a capturar variantes.")).toBeInTheDocument();
  });

  it("groups rows under their size instead of repeating a 'Talla' field", () => {
    const variants = [row({ size: "54", sku: "A" }), row({ size: "M", sku: "B" })];
    render(<VariantsEditor variants={variants} onChange={vi.fn()} mode="edit" />);

    expect(screen.getByText("54")).toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.queryByLabelText("Talla")).not.toBeInTheDocument();
  });

  it("labels a variant with no size 'Sin talla' instead of an empty heading", () => {
    render(<VariantsEditor variants={[row({ size: "" })]} onChange={vi.fn()} mode="edit" />);
    expect(screen.getByText("Sin talla")).toBeInTheDocument();
  });

  it("shows a duplicate-SKU error on both rows once two variants collide, even across different sizes", () => {
    const variants = [row({ size: "54", sku: "BK-DUP" }), row({ size: "M", sku: "BK-DUP" })];
    render(<VariantsEditor variants={variants} onChange={vi.fn()} mode="edit" />);

    expect(screen.getAllByText("SKU repetido entre variantes.")).toHaveLength(2);
  });

  it("does not show the duplicate error when SKUs are unique", () => {
    const variants = [row({ size: "54", sku: "BK-A" }), row({ size: "54", sku: "BK-B" })];
    render(<VariantsEditor variants={variants} onChange={vi.fn()} mode="edit" />);

    expect(screen.queryByText("SKU repetido entre variantes.")).not.toBeInTheDocument();
  });

  it("only shows the estimated-date field when fulfillmentMode is preorder", () => {
    const { rerender } = render(
      <VariantsEditor variants={[row({ size: "54", fulfillmentMode: "in_stock" })]} onChange={vi.fn()} mode="edit" />,
    );
    expect(screen.queryByLabelText("Fecha estimada")).not.toBeInTheDocument();

    rerender(
      <VariantsEditor variants={[row({ size: "54", fulfillmentMode: "preorder" })]} onChange={vi.fn()} mode="edit" />,
    );
    expect(screen.getByLabelText("Fecha estimada")).toBeInTheDocument();
  });

  it("adds a new row under the same size on 'Agregar variante en esta talla'", () => {
    const onChange = vi.fn();
    render(<VariantsEditor variants={[row({ size: "54" })]} onChange={onChange} mode="edit" />);

    fireEvent.click(screen.getByRole("button", { name: "Agregar variante en esta talla" }));

    expect(onChange).toHaveBeenCalledWith([row({ size: "54" }), { ...emptyVariantRow(), size: "54" }]);
  });

  it("renders the SKU field as read-only — it's computed automatically, not typed", () => {
    render(<VariantsEditor variants={[row({ size: "54", sku: "BK-TARMAC-M" })]} onChange={vi.fn()} mode="edit" />);

    const skuInput = screen.getByLabelText("SKU") as HTMLInputElement;
    expect(skuInput).toHaveAttribute("readOnly");
    expect(skuInput).toBeDisabled();
    expect(skuInput.value).toBe("BK-TARMAC-M");
  });

  it("computes the SKU from brand, model, size and color for a new row", () => {
    const onChange = vi.fn();
    const variants = [row({ size: "54", color: "", sku: "" })];
    const { rerender } = render(
      <VariantsEditor
        variants={variants}
        onChange={onChange}
        mode="edit"
        brandName="Trek"
        productName="Domane SL 5"
        colorTemplates={[colorTemplate({ value: "Negro" })]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Color"), { target: { value: "Negro" } });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ sku: "TRE-DOMSL5-54-NEG" })]);

    rerender(
      <VariantsEditor
        variants={[{ ...variants[0]!, color: "Negro", sku: "TRE-DOMSL5-54-NEG" }]}
        onChange={onChange}
        mode="edit"
        brandName="Trek"
        productName="Domane SL 5"
      />,
    );
  });

  it("never recomputes the SKU of a row hydrated from an existing product, even when brand/model change", () => {
    const onChange = vi.fn();
    const existingRow = { ...row({ size: "54", color: "Negro", sku: "TRE-DOMSL5-54-NEG" }), isNewRow: false };
    const { rerender } = render(
      <VariantsEditor variants={[existingRow]} onChange={onChange} mode="edit" brandName="Trek" productName="Domane SL 5" />,
    );

    rerender(
      <VariantsEditor
        variants={[existingRow]}
        onChange={onChange}
        mode="edit"
        brandName="Trek"
        productName="Domane SL 6"
      />,
    );

    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes only the clicked row, not the whole size group", () => {
    const onChange = vi.fn();
    const variants = [row({ size: "54", sku: "A" }), row({ size: "54", sku: "B" })];
    render(<VariantsEditor variants={variants} onChange={onChange} mode="edit" />);

    fireEvent.click(screen.getAllByRole("button", { name: "Eliminar variante" })[0]!);

    expect(onChange).toHaveBeenCalledWith([variants[1]]);
  });

  describe("sizeless (category doesn't manage sizes)", () => {
    it("shows an 'Agregar variante' button instead of the 'elige una talla' placeholder when there are no variants yet", () => {
      render(<VariantsEditor variants={[]} onChange={vi.fn()} sizeless mode="edit" />);
      expect(screen.getByRole("button", { name: "Agregar variante" })).toBeInTheDocument();
      expect(screen.queryByText("Elige una talla arriba para empezar a capturar variantes.")).not.toBeInTheDocument();
    });

    it("adds a row with an empty size on click", () => {
      const onChange = vi.fn();
      render(<VariantsEditor variants={[]} onChange={onChange} sizeless mode="edit" />);

      fireEvent.click(screen.getByRole("button", { name: "Agregar variante" }));

      expect(onChange).toHaveBeenCalledWith([{ ...emptyVariantRow(), size: "" }]);
    });

    it("still shows the original placeholder when sizeless is false (default), no regression", () => {
      render(<VariantsEditor variants={[]} onChange={vi.fn()} mode="edit" />);
      expect(screen.getByText("Elige una talla arriba para empezar a capturar variantes.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Agregar variante" })).not.toBeInTheDocument();
    });
  });

  describe("initial stock (M11 create, M11.x new rows added mid-edit)", () => {
    it("shows Stock inicial for a new in_stock row in create mode", () => {
      render(
        <VariantsEditor variants={[row({ size: "54", fulfillmentMode: "in_stock" })]} onChange={vi.fn()} mode="create" />,
      );
      expect(screen.getByLabelText("Stock inicial")).toBeInTheDocument();
    });

    it("shows Stock inicial for a new (isNewRow) in_stock row even in edit mode", () => {
      render(
        <VariantsEditor variants={[row({ size: "54", fulfillmentMode: "in_stock" })]} onChange={vi.fn()} mode="edit" />,
      );
      expect(screen.getByLabelText("Stock inicial")).toBeInTheDocument();
    });

    it("never shows Stock inicial for a row hydrated from an existing product in edit mode", () => {
      const existingRow = { ...row({ size: "54", fulfillmentMode: "in_stock" }), isNewRow: false };
      render(<VariantsEditor variants={[existingRow]} onChange={vi.fn()} mode="edit" />);
      expect(screen.queryByLabelText("Stock inicial")).not.toBeInTheDocument();
    });

    it("does not show Stock inicial for on_request or preorder, even in create mode", () => {
      const { rerender } = render(
        <VariantsEditor variants={[row({ size: "54", fulfillmentMode: "on_request" })]} onChange={vi.fn()} mode="create" />,
      );
      expect(screen.queryByLabelText("Stock inicial")).not.toBeInTheDocument();

      rerender(
        <VariantsEditor variants={[row({ size: "54", fulfillmentMode: "preorder" })]} onChange={vi.fn()} mode="create" />,
      );
      expect(screen.queryByLabelText("Stock inicial")).not.toBeInTheDocument();
    });

    it("carries the typed value into the row via onChange", () => {
      const onChange = vi.fn();
      render(
        <VariantsEditor
          variants={[row({ size: "54", fulfillmentMode: "in_stock" })]}
          onChange={onChange}
          mode="create"
        />,
      );

      fireEvent.change(screen.getByLabelText("Stock inicial"), { target: { value: "5" } });

      expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ initialStock: "5" })]);
    });
  });

  describe("color picker (real color selector with hex swatch)", () => {
    it("lists the catalog's colors as options, sorted by order", () => {
      const colorTemplates = [colorTemplate({ id: "ct-2", value: "Azul", order: 1 }), colorTemplate({ id: "ct-1", value: "Negro", order: 0 })];
      render(<VariantsEditor variants={[row({ size: "54" })]} onChange={vi.fn()} mode="edit" colorTemplates={colorTemplates} />);

      const select = screen.getByLabelText("Color") as HTMLSelectElement;
      const optionLabels = Array.from(select.options).map((option) => option.textContent);
      expect(optionLabels).toEqual(["Sin color", "Negro", "Azul"]);
    });

    it("selecting a catalog color updates the row via onChange", () => {
      const onChange = vi.fn();
      const colorTemplates = [colorTemplate({ value: "Negro" })];
      render(
        <VariantsEditor variants={[row({ size: "54", color: "" })]} onChange={onChange} mode="edit" colorTemplates={colorTemplates} />,
      );

      fireEvent.change(screen.getByLabelText("Color"), { target: { value: "Negro" } });

      expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ color: "Negro" })]);
    });

    it("renders a solid swatch reflecting the selected color's hex", () => {
      const colorTemplates = [colorTemplate({ value: "Negro", hex: "#0A0A0A" })];
      render(
        <VariantsEditor variants={[row({ size: "54", color: "Negro" })]} onChange={vi.fn()} mode="edit" colorTemplates={colorTemplates} />,
      );

      const swatch = document.querySelector('[aria-hidden="true"].rounded-full') as HTMLElement;
      expect(swatch.style.backgroundColor).toBe("rgb(10, 10, 10)");
    });

    it("renders a dashed placeholder swatch when the row has no color selected", () => {
      render(<VariantsEditor variants={[row({ size: "54", color: "" })]} onChange={vi.fn()} mode="edit" colorTemplates={[]} />);

      const swatch = document.querySelector('[aria-hidden="true"].rounded-full') as HTMLElement;
      expect(swatch.style.backgroundColor).toBe("");
    });

    it("lets the admin type a color not yet in the catalog via 'Nuevo color…', and it lands in row.color", () => {
      const onChange = vi.fn();
      render(<VariantsEditor variants={[row({ size: "54", color: "" })]} onChange={onChange} mode="edit" colorTemplates={[]} />);

      fireEvent.click(screen.getByRole("button", { name: "Nuevo color…" }));
      fireEvent.change(screen.getByLabelText("Nombre del color"), { target: { value: "Verde militar" } });

      expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ color: "Verde militar" })]);
    });

    it("'Volver a la lista' switches back from the free-text input to the Select", () => {
      render(<VariantsEditor variants={[row({ size: "54", color: "" })]} onChange={vi.fn()} mode="edit" colorTemplates={[]} />);

      fireEvent.click(screen.getByRole("button", { name: "Nuevo color…" }));
      expect(screen.getByLabelText("Nombre del color")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Volver a la lista" }));
      expect(screen.queryByLabelText("Nombre del color")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Color")).toBeInTheDocument();
    });

    it("shows a row's already-saved color even when it's no longer in the catalog, with a '(nuevo)' hint", () => {
      render(
        <VariantsEditor variants={[row({ size: "54", color: "Vintage" })]} onChange={vi.fn()} mode="edit" colorTemplates={[]} />,
      );

      const select = screen.getByLabelText("Color") as HTMLSelectElement;
      expect(select.value).toBe("Vintage");
      expect(screen.getByText("Vintage (nuevo)")).toBeInTheDocument();
    });
  });
});
