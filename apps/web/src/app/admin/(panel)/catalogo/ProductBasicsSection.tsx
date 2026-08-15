"use client";

import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { slugify } from "@/lib/catalog/slugify";
import { PRODUCT_FIELD_IDS } from "./field-ids";
import { SectionHelp } from "./SectionHelp";

export interface ProductBasicsValue {
  name: string;
  /**
   * Never typed by the admin — the server generates it (`slugify`, lowercase,
   * accent-folded). Empty on create (nothing persisted yet: the field shows a
   * live preview instead) or the already-persisted value on edit, which stays
   * fixed even if the name changes afterward.
   */
  slug: string;
  brand: string;
  category: string;
  description: string;
  /** Pesos as typed (`lib/catalog/price.ts` converts to/from integer cents at the editor's submit boundary). */
  priceInput: string;
  compareAtPriceInput: string;
}

export interface ProductBasicsSectionProps {
  value: ProductBasicsValue;
  onChange: (value: ProductBasicsValue) => void;
  errors?: Partial<Record<keyof ProductBasicsValue, string>>;
}

/**
 * Name, slug, description and pricing — the fields both catalogs share
 * (`productBase` in `product.validator.ts`) that stay in the editor's main
 * column. Marca/Categoría moved out to `ProductOrganizationFields` (the right
 * rail) and bike-only fields live in the sibling `BikeBasicsFields`; all
 * three write into this same `ProductBasicsValue`.
 */
export function ProductBasicsSection({ value, onChange, errors = {} }: ProductBasicsSectionProps) {
  function set<K extends keyof ProductBasicsValue>(key: K, next: ProductBasicsValue[K]): void {
    onChange({ ...value, [key]: next });
  }

  // Already-persisted slug (edit) wins over a live preview (create) — see
  // `ProductBasicsValue.slug`'s own doc comment.
  const slugPreview = value.slug || slugify(value.name);

  return (
    <div className="flex flex-col gap-md">
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <Input
          id={PRODUCT_FIELD_IDS.name}
          label="Nombre"
          required
          placeholder="p. ej. Trek Domane SL 5"
          value={value.name}
          onChange={(event) => set("name", event.target.value)}
          error={errors.name}
        />
        <Input
          label="Slug"
          helper="Se genera automáticamente del nombre."
          value={slugPreview}
          disabled
          readOnly
          error={errors.slug}
        />
      </div>

      <div className="flex flex-col gap-xs">
        <div className="flex items-center gap-xs">
          {/* A `<span>`, not a second `<label htmlFor>` — the `Textarea` below already carries the real (visually hidden) label via `labelHidden`; a second label targeting the same id would concatenate into the accessible name instead of replacing it. */}
          <span className="font-ui text-ui text-negro">Descripción</span>
          <SectionHelp zone="descripcion" />
        </div>
        <Textarea
          id={PRODUCT_FIELD_IDS.description}
          label="Descripción"
          labelHidden
          required
          rows={5}
          placeholder="Describe el producto para la ficha pública: materiales, uso recomendado, qué lo distingue."
          value={value.description}
          onChange={(event) => set("description", event.target.value)}
          error={errors.description}
        />
      </div>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <Input
          id={PRODUCT_FIELD_IDS.priceInput}
          label="Precio (MXN)"
          required
          inputMode="decimal"
          placeholder="0.00"
          helper="En pesos, con dos decimales."
          value={value.priceInput}
          onChange={(event) => set("priceInput", event.target.value)}
          error={errors.priceInput}
        />
        <Input
          id={PRODUCT_FIELD_IDS.compareAtPriceInput}
          label="Precio anterior (opcional)"
          inputMode="decimal"
          placeholder="0.00"
          helper="Debe ser mayor al precio actual."
          value={value.compareAtPriceInput}
          onChange={(event) => set("compareAtPriceInput", event.target.value)}
          error={errors.compareAtPriceInput}
        />
      </div>
    </div>
  );
}
