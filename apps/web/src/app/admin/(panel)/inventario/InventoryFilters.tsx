"use client";

import type { AdminBrand } from "@bw-bikes/shared";
import { Funnel } from "@phosphor-icons/react";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SlideOver } from "@/components/ui/SlideOver";
import type { CategoryTreeNode } from "@/lib/api/admin-catalog";

export interface InventoryFiltersValue {
  search: string;
  category: string;
  /** The brand's `slug` — never a raw id or free text, same convention `CatalogFiltersValue.brand` uses. */
  brand: string;
  sort: string;
}

export interface InventoryFiltersProps {
  value: InventoryFiltersValue;
  onChange: (value: InventoryFiltersValue) => void;
  categoryTree: CategoryTreeNode[];
  brands: AdminBrand[];
}

export const DEFAULT_INVENTORY_FILTERS: InventoryFiltersValue = {
  search: "",
  category: "",
  brand: "",
  sort: "name",
};

/** Fields the mobile "Filtros" sheet owns — `search` stays out because it's always visible on its own, same split `CatalogFilters` uses. */
const SHEET_FIELDS = ["category", "brand", "sort"] as const satisfies ReadonlyArray<keyof InventoryFiltersValue>;

function countActiveFilters(value: InventoryFiltersValue): number {
  return SHEET_FIELDS.filter((field) => value[field] !== DEFAULT_INVENTORY_FILTERS[field]).length;
}

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "name", label: "Nombre A-Z" },
  { value: "-totalAvailable", label: "Disponible: mayor a menor" },
  { value: "totalAvailable", label: "Disponible: menor a mayor" },
  { value: "-createdAt", label: "Más recientes primero" },
];

interface SharedFieldProps {
  value: InventoryFiltersValue;
  onChange: (value: InventoryFiltersValue) => void;
  wrapperClassName?: string;
}

/** Shared between the inline `md:` row and the mobile sheet, so the two never drift on options or labels — same reasoning as `CatalogFilters`'s field components. */
function CategorySelect({ value, onChange, wrapperClassName, categoryTree }: SharedFieldProps & { categoryTree: CategoryTreeNode[] }) {
  return (
    <Select
      label="Categoría"
      wrapperClassName={wrapperClassName}
      value={value.category}
      onChange={(event) => onChange({ ...value, category: event.target.value })}
    >
      <option value="">Todas</option>
      {categoryTree.map((root) => (
        <Fragment key={root.id}>
          <option value={root.id}>{root.name}</option>
          {root.children.length > 0 ? (
            <optgroup label={root.name}>
              {root.children.map((child) => (
                <option key={child.id} value={child.id}>
                  — {child.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </Fragment>
      ))}
    </Select>
  );
}

function BrandSelect({ value, onChange, wrapperClassName, brands }: SharedFieldProps & { brands: AdminBrand[] }) {
  return (
    <Select label="Marca" wrapperClassName={wrapperClassName} value={value.brand} onChange={(event) => onChange({ ...value, brand: event.target.value })}>
      <option value="">Todas</option>
      {brands.map((brand) => (
        <option key={brand.id} value={brand.slug}>
          {brand.name}
        </option>
      ))}
    </Select>
  );
}

function SortSelect({ value, onChange, wrapperClassName }: SharedFieldProps) {
  return (
    <Select label="Ordenar por" wrapperClassName={wrapperClassName} value={value.sort} onChange={(event) => onChange({ ...value, sort: event.target.value })}>
      {SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

/**
 * `InventoryStatusChips` already owns the agotado/bajo axis right below this
 * row — no "Estatus" select here, or the panel would offer two controls for
 * the same thing, which is exactly the confusion the redesign is meant to
 * fix. Otherwise the same responsive shape as `CatalogFilters`: `Buscar`
 * stays visible full-width next to a `Filtros` button (badge shows the
 * active count) that opens Categoría/Marca/Ordenar in a `SlideOver` below
 * `md`; the original inline row from `md:` up.
 */
export function InventoryFilters({ value, onChange, categoryTree, brands }: InventoryFiltersProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeCount = countActiveFilters(value);

  return (
    <div className="flex flex-1 flex-col gap-md md:flex-row md:flex-wrap md:items-end">
      <div className="flex items-end gap-sm md:contents">
        <Input
          label="Buscar"
          placeholder="Nombre, marca o SKU"
          value={value.search}
          onChange={(event) => onChange({ ...value, search: event.target.value })}
          wrapperClassName="flex-1 md:flex-none md:min-w-[16rem]"
        />
        <Button variant="ghost" onClick={() => setSheetOpen(true)} className="md:hidden">
          <Funnel size={18} aria-hidden="true" />
          Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
      </div>

      <div className="hidden md:contents">
        <CategorySelect value={value} onChange={onChange} categoryTree={categoryTree} />
        <BrandSelect value={value} onChange={onChange} brands={brands} />
        <SortSelect value={value} onChange={onChange} />
      </div>

      <SlideOver
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filtros"
        footer={
          <>
            <Button variant="ghost" onClick={() => onChange({ ...DEFAULT_INVENTORY_FILTERS, search: value.search })}>
              Limpiar filtros
            </Button>
            <Button variant="primary" onClick={() => setSheetOpen(false)}>
              Ver resultados
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-md">
          <CategorySelect value={value} onChange={onChange} categoryTree={categoryTree} wrapperClassName="w-full" />
          <BrandSelect value={value} onChange={onChange} brands={brands} wrapperClassName="w-full" />
          <SortSelect value={value} onChange={onChange} wrapperClassName="w-full" />
        </div>
      </SlideOver>
    </div>
  );
}
