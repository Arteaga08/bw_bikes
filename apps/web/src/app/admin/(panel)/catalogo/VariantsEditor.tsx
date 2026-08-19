"use client";

import { useEffect, useState } from "react";
import type { ColorTemplate, FulfillmentMode } from "@bw-bikes/shared";
import { Button } from "@/components/ui/Button";
import { ColorSwatch } from "@/components/ui/ColorSwatch";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { buildSkuBase, ensureUniqueSku } from "@/lib/catalog/sku";
import { ALL_FULFILLMENT_MODES, FULFILLMENT_MODE_LABELS } from "@/lib/catalog/labels";

/** Mirrors `MAX_VARIANTS` in `apps/api/src/models/schemas/product-variant.schema.ts`. */
export const MAX_VARIANTS = 40;

/** A variant row as the form edits it — `price` becomes a plain pesos string, same reasoning as `ProductBasicsValue.priceInput`. */
export interface VariantRow {
  sku: string;
  size: string;
  color: string;
  priceInput: string;
  fulfillmentMode: FulfillmentMode;
  preorderReleaseDate?: string;
  isActive: boolean;
  /**
   * Physical stock to seed on creation (M11) — plain text like `priceInput`,
   * parsed to an integer only when the product is actually saved. Write-only
   * and create-only: `ProductEditor` never populates this from an existing
   * product, and `VariantsEditor` doesn't render the field at all in `mode:
   * "edit"` — see that prop's own doc comment for why.
   */
  initialStock?: string;
  /**
   * True for a row added during this form session (via `SizePicker` or
   * "Agregar variante en esta talla"), in either `create` or `edit` mode —
   * false/absent for a row hydrated from an already-persisted product
   * (`ProductEditor.variantsFromProduct`). Drives two things: whether the
   * SKU auto-computes from brand/model/size/color (a persisted SKU is
   * frozen — see the `sku` field's own note on `VariantsEditorProps`), and
   * whether "Stock inicial" renders for it in edit mode.
   */
  isNewRow?: boolean;
}

export function emptyVariantRow(): VariantRow {
  return { sku: "", size: "", color: "", priceInput: "", fulfillmentMode: "in_stock", isActive: true, isNewRow: true };
}

/**
 * Indices of rows whose SKU collides with another row's — pure and exported
 * so it's testable without mounting the component, and so `ProductEditor`
 * can block its own "Guardar" button on the same check without duplicating
 * the comparison logic (mirrors `assertVariantSkusAreUnique` in
 * `apps/api/src/services/product.service.ts`, uppercase-normalized the same
 * way the backend's `sku` Joi schema does).
 */
export function findDuplicateSkuIndices(variants: VariantRow[]): Set<number> {
  const seen = new Map<string, number>();
  const duplicates = new Set<number>();

  variants.forEach((variant, index) => {
    const sku = variant.sku.trim().toUpperCase();
    if (!sku) return;
    const firstIndex = seen.get(sku);
    if (firstIndex !== undefined) {
      duplicates.add(firstIndex);
      duplicates.add(index);
    } else {
      seen.set(sku, index);
    }
  });

  return duplicates;
}

interface VariantGroup {
  size: string;
  /** Original indices into the flat `variants` array — kept instead of copying rows so `updateRow`/`removeRow` can still address the source array directly. */
  indices: number[];
}

/** One entry per distinct `size` already present, in first-appearance order — first-appearance instead of alphabetical so a group doesn't jump position as its own rows change. */
function groupBySize(variants: VariantRow[]): VariantGroup[] {
  const groups: VariantGroup[] = [];
  const groupIndexBySize = new Map<string, number>();

  variants.forEach((variant, index) => {
    let groupIndex = groupIndexBySize.get(variant.size);
    if (groupIndex === undefined) {
      groupIndex = groups.length;
      groupIndexBySize.set(variant.size, groupIndex);
      groups.push({ size: variant.size, indices: [] });
    }
    groups[groupIndex]!.indices.push(index);
  });

  return groups;
}

export interface VariantsEditorProps {
  variants: VariantRow[];
  onChange: (variants: VariantRow[]) => void;
  /** True when the product's category doesn't manage sizes — `SizePicker` isn't rendered, so this component owns the empty state and the affordance to add the product's single implicit "Sin talla" group. */
  sizeless?: boolean;
  /**
   * The Stock inicial field renders for `in_stock` rows (never `on_request`/
   * `preorder`, same as the preorder-only date field) that are also
   * `isNewRow` — always true in `create` mode, and true in `edit` mode only
   * for a variant added during this session. A row hydrated from an
   * already-persisted product never shows it: editing its stock here would
   * silently overwrite whatever `/admin/inventario` adjusted since the form
   * opened, with no reason and no audit entry. Adjusting existing stock
   * stays a dedicated action on that screen instead.
   */
  mode: "create" | "edit";
  /** Feeds `buildSkuBase` for `isNewRow` rows — the product's own name/brand, so the SKU stays in sync as the admin types them in an earlier step. */
  productName?: string;
  brandName?: string;
  /** Feeds the row-level color `<Select>` (real selector, not free text) and its swatch — sorted by `order` at render. */
  colorTemplates?: ColorTemplate[];
}

/**
 * Rows grouped under the size that created them (`SizePicker`, M10.7 S3)
 * instead of repeating a "Talla" field on every row — choosing *which*
 * sizes exist is the picker's job now; this only ever adds, edits or
 * removes the SKU-level detail (color, price override, availability)
 * underneath an already-chosen size. A group with zero rows never renders:
 * `SizePicker` removes the whole group the instant its last row goes away,
 * so there's nothing here to clean up on this side.
 */
export function VariantsEditor({
  variants,
  onChange,
  sizeless = false,
  mode,
  productName = "",
  brandName = "",
  colorTemplates = [],
}: VariantsEditorProps) {
  const duplicates = findDuplicateSkuIndices(variants);
  const groups = groupBySize(variants);
  const sortedColorTemplates = colorTemplates.slice().sort((a, b) => a.order - b.order);

  // Rows currently showing the free-text "Nuevo color" input instead of the
  // `<Select>` — UI-only, never persisted; a row leaves this set the moment
  // it's removed or the admin clicks "Volver a la lista".
  const [customColorRows, setCustomColorRows] = useState<Set<number>>(new Set());

  function enterCustomColor(index: number): void {
    setCustomColorRows((prev) => new Set(prev).add(index));
  }

  function exitCustomColor(index: number): void {
    setCustomColorRows((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }

  // Keeps a new row's SKU in sync as the admin fills in the product's own
  // name/brand in an earlier wizard step — deliberately keyed on those two
  // strings only, not on `variants`, so it fires exactly when they change
  // and never loops back on its own `onChange` call.
  useEffect(() => {
    const taken = new Set(variants.filter((row) => !row.isNewRow && row.sku).map((row) => row.sku));
    let changed = false;

    const next = variants.map((row) => {
      if (!row.isNewRow) return row;
      const base = buildSkuBase(brandName, productName, row.size, row.color);
      const sku = ensureUniqueSku(base, taken);
      if (sku) taken.add(sku);
      if (sku === row.sku) return row;
      changed = true;
      return { ...row, sku };
    });

    if (changed) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandName, productName]);

  function updateRow(index: number, patch: Partial<VariantRow>): void {
    onChange(
      variants.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        if (row.isNewRow && ("size" in patch || "color" in patch)) {
          const base = buildSkuBase(brandName, productName, next.size, next.color);
          const taken = new Set(variants.filter((_, j) => j !== index).map((v) => v.sku).filter(Boolean));
          next.sku = ensureUniqueSku(base, taken);
        }
        return next;
      }),
    );
  }

  function removeRow(index: number): void {
    onChange(variants.filter((_, i) => i !== index));
  }

  function addRowToGroup(size: string): void {
    if (variants.length >= MAX_VARIANTS) return;
    onChange([...variants, { ...emptyVariantRow(), size }]);
  }

  if (groups.length === 0) {
    if (sizeless) {
      return (
        <Button variant="secondary" size="sm" onClick={() => addRowToGroup("")} className="self-start">
          Agregar variante
        </Button>
      );
    }
    return <p className="font-body text-caption text-grafito">Elige una talla arriba para empezar a capturar variantes.</p>;
  }

  return (
    <div className="flex flex-col gap-md">
      {groups.map((group) => (
        // `bg-inset` — a panel nested inside an `EditorSection` card, same case
        // as `SpecSheetEditor`: `base` is the page's ground, not a layer
        // available above `surface`.
        <div key={group.size} className="flex flex-col gap-sm rounded-control border border-borde bg-inset p-md">
          <span className="font-ui text-ui text-negro">{group.size || "Sin talla"}</span>

          <div className="flex flex-col divide-y divide-borde">
            {group.indices.map((index) => {
              const row = variants[index]!;
              const currentColorTemplate = colorTemplates.find((template) => template.value === row.color);
              const currentColorHex = currentColorTemplate?.hex ?? null;
              const currentSecondaryHex = currentColorTemplate?.secondaryHex ?? null;
              return (
                <div key={index} className="flex flex-col gap-sm py-sm first:pt-0 last:pb-0">
                  <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
                    <Input
                      label="SKU"
                      value={row.sku}
                      disabled
                      readOnly
                      helper="Se genera automáticamente de marca, modelo, talla y color."
                      error={duplicates.has(index) ? "SKU repetido entre variantes." : undefined}
                    />
                    {customColorRows.has(index) ? (
                      <div className="flex items-end gap-sm">
                        <Input
                          label="Nombre del color"
                          placeholder="p. ej. Verde militar"
                          value={row.color}
                          onChange={(event) => updateRow(index, { color: event.target.value })}
                          wrapperClassName="min-w-0 flex-1"
                        />
                        <Button variant="ghost" size="sm" onClick={() => exitCustomColor(index)}>
                          Volver a la lista
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-end gap-sm">
                        <Select
                          label="Color"
                          value={row.color}
                          onChange={(event) => updateRow(index, { color: event.target.value })}
                          wrapperClassName="min-w-0 flex-1"
                        >
                          <option value="">Sin color</option>
                          {sortedColorTemplates.map((template) => (
                            <option key={template.id} value={template.value}>
                              {template.value}
                            </option>
                          ))}
                          {row.color && !colorTemplates.some((template) => template.value === row.color) ? (
                            <option value={row.color}>{row.color} (nuevo)</option>
                          ) : null}
                        </Select>
                        <ColorSwatch hex={currentColorHex} secondaryHex={currentSecondaryHex} className="mb-0.5 h-11 w-11" />
                        <Button variant="ghost" size="sm" onClick={() => enterCustomColor(index)}>
                          Nuevo color…
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
                    <Input
                      label="Precio override (opcional)"
                      inputMode="decimal"
                      placeholder="Usa el precio del producto"
                      value={row.priceInput}
                      onChange={(event) => updateRow(index, { priceInput: event.target.value })}
                    />
                    <Select
                      label="Disponibilidad"
                      value={row.fulfillmentMode}
                      onChange={(event) => updateRow(index, { fulfillmentMode: event.target.value as FulfillmentMode })}
                    >
                      {ALL_FULFILLMENT_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {FULFILLMENT_MODE_LABELS[mode]}
                        </option>
                      ))}
                    </Select>
                    {row.fulfillmentMode === "preorder" ? (
                      <Input
                        label="Fecha estimada"
                        type="date"
                        value={row.preorderReleaseDate?.slice(0, 10) ?? ""}
                        onChange={(event) => updateRow(index, { preorderReleaseDate: event.target.value || undefined })}
                      />
                    ) : (
                      <div aria-hidden="true" />
                    )}
                  </div>

                  {(mode === "create" || row.isNewRow) && row.fulfillmentMode === "in_stock" ? (
                    <Input
                      label="Stock inicial"
                      inputMode="numeric"
                      placeholder="0"
                      value={row.initialStock ?? ""}
                      onChange={(event) => updateRow(index, { initialStock: event.target.value })}
                      helper="Unidades en bodega al crear el producto. Después se ajusta desde Inventario."
                      wrapperClassName="sm:max-w-[12rem]"
                    />
                  ) : null}

                  <div className="flex items-center justify-between">
                    <Toggle
                      label="Activa"
                      checked={row.isActive}
                      onChange={(checked) => updateRow(index, { isActive: checked })}
                    />
                    <Button variant="ghost" size="sm" onClick={() => removeRow(index)}>
                      Eliminar variante
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            variant="secondary"
            size="sm"
            disabled={variants.length >= MAX_VARIANTS}
            onClick={() => addRowToGroup(group.size)}
            className="self-start"
          >
            Agregar variante en esta talla
          </Button>
        </div>
      ))}
    </div>
  );
}
