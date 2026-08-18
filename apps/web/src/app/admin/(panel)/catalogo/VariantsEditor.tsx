"use client";

import type { FulfillmentMode } from "@bw-bikes/shared";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
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
}

export function emptyVariantRow(): VariantRow {
  return { sku: "", size: "", color: "", priceInput: "", fulfillmentMode: "in_stock", isActive: true };
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
   * `"create"` shows the Stock inicial field (`in_stock` rows only — an
   * `on_request`/`preorder` variant holds no stock, so the field is skipped
   * for those the same way the preorder-only date field skips everything
   * else). `"edit"` never renders it: stock capture only happens once, at
   * creation — editing an existing variant's stock here would silently
   * overwrite whatever `/admin/inventario` adjusted since the form opened,
   * with no reason and no audit entry. Adjusting existing stock stays a
   * dedicated action on that screen instead.
   */
  mode: "create" | "edit";
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
export function VariantsEditor({ variants, onChange, sizeless = false, mode }: VariantsEditorProps) {
  const duplicates = findDuplicateSkuIndices(variants);
  const groups = groupBySize(variants);

  function updateRow(index: number, patch: Partial<VariantRow>): void {
    onChange(variants.map((row, i) => (i === index ? { ...row, ...patch } : row)));
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
              return (
                <div key={index} className="flex flex-col gap-sm py-sm first:pt-0 last:pb-0">
                  <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
                    <Input
                      label="SKU"
                      placeholder="p. ej. DOM-SL5-54-NEG"
                      value={row.sku}
                      onChange={(event) => updateRow(index, { sku: event.target.value.toUpperCase() })}
                      error={duplicates.has(index) ? "SKU repetido entre variantes." : undefined}
                    />
                    <Input
                      label="Color"
                      placeholder="p. ej. Negro mate"
                      value={row.color}
                      onChange={(event) => updateRow(index, { color: event.target.value })}
                    />
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

                  {mode === "create" && row.fulfillmentMode === "in_stock" ? (
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
