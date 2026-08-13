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

export interface VariantsEditorProps {
  variants: VariantRow[];
  onChange: (variants: VariantRow[]) => void;
}

export function VariantsEditor({ variants, onChange }: VariantsEditorProps) {
  const duplicates = findDuplicateSkuIndices(variants);

  function updateRow(index: number, patch: Partial<VariantRow>): void {
    onChange(variants.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number): void {
    onChange(variants.filter((_, i) => i !== index));
  }

  function addRow(): void {
    if (variants.length >= MAX_VARIANTS) return;
    onChange([...variants, emptyVariantRow()]);
  }

  return (
    <div className="flex flex-col gap-md">
      {variants.length === 0 ? <p className="font-body text-caption text-grafito">Sin variantes todavía.</p> : null}

      {variants.map((row, index) => (
        <div key={index} className="flex flex-col gap-sm rounded-control border border-borde bg-base p-md">
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
            <Input
              label="SKU"
              placeholder="p. ej. DOM-SL5-54-NEG"
              value={row.sku}
              onChange={(event) => updateRow(index, { sku: event.target.value.toUpperCase() })}
              error={duplicates.has(index) ? "SKU repetido entre variantes." : undefined}
            />
            <Input
              label="Talla"
              placeholder="p. ej. 54"
              value={row.size}
              onChange={(event) => updateRow(index, { size: event.target.value })}
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

          <div className="flex items-center justify-between">
            <Toggle label="Activa" checked={row.isActive} onChange={(checked) => updateRow(index, { isActive: checked })} />
            <Button variant="ghost" size="sm" onClick={() => removeRow(index)}>
              Eliminar variante
            </Button>
          </div>
        </div>
      ))}

      <Button variant="secondary" disabled={variants.length >= MAX_VARIANTS} onClick={addRow} className="self-start">
        Agregar variante
      </Button>
    </div>
  );
}
