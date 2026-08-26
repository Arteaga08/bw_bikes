"use client";

import type { AdminBrand } from "@bw-bikes/shared";
import { Funnel } from "@phosphor-icons/react";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SlideOver } from "@/components/ui/SlideOver";
import type { CategoryTreeNode } from "@/lib/api/admin-catalog";

export interface CatalogFiltersValue {
  search: string;
  category: string;
  /** The brand's `slug` (see `adminProductListQuerySchema`'s `brand` param) — never a raw id or free text. */
  brand: string;
  isActive: "" | "true" | "false";
  /** The home's "Novedades" curation flag (`Bike.isNewArrival`), not a badge. */
  isNewArrival: "" | "true" | "false";
  /** The home's "Favoritas de los ciclistas" flag (`Bike.isCustomerFavorite`), not a badge either. */
  isCustomerFavorite: "" | "true" | "false";
  sort: string;
}

export interface CatalogFiltersProps {
  value: CatalogFiltersValue;
  onChange: (value: CatalogFiltersValue) => void;
  categoryTree: CategoryTreeNode[];
  brands: AdminBrand[];
}

export const DEFAULT_FILTERS: CatalogFiltersValue = {
  search: "",
  category: "",
  brand: "",
  isActive: "",
  isNewArrival: "",
  isCustomerFavorite: "",
  sort: "-createdAt",
};

/** Fields the mobile "Filtros" sheet owns — `search` stays out because it's always visible on its own. */
const SHEET_FIELDS = ["category", "brand", "isActive", "isNewArrival", "isCustomerFavorite", "sort"] as const satisfies ReadonlyArray<
  keyof CatalogFiltersValue
>;

function countActiveFilters(value: CatalogFiltersValue): number {
  return SHEET_FIELDS.filter((field) => value[field] !== DEFAULT_FILTERS[field]).length;
}

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "-createdAt", label: "Más recientes primero" },
  { value: "createdAt", label: "Más antiguos primero" },
  { value: "-price", label: "Precio: mayor a menor" },
  { value: "price", label: "Precio: menor a mayor" },
  { value: "name", label: "Nombre A-Z" },
];

interface SharedFieldProps {
  value: CatalogFiltersValue;
  onChange: (value: CatalogFiltersValue) => void;
  wrapperClassName?: string;
}

/** Shared between the inline `md:` row and the mobile sheet, so the two never drift on options or labels. */
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

function StatusSelect({ value, onChange, wrapperClassName }: SharedFieldProps) {
  return (
    <Select
      label="Estatus"
      wrapperClassName={wrapperClassName}
      value={value.isActive}
      onChange={(event) => onChange({ ...value, isActive: event.target.value as CatalogFiltersValue["isActive"] })}
    >
      <option value="">Todos</option>
      <option value="true">Activos</option>
      <option value="false">Archivados</option>
    </Select>
  );
}

function NewArrivalSelect({ value, onChange, wrapperClassName }: SharedFieldProps) {
  return (
    <Select
      label="Novedad"
      wrapperClassName={wrapperClassName}
      value={value.isNewArrival}
      onChange={(event) => onChange({ ...value, isNewArrival: event.target.value as CatalogFiltersValue["isNewArrival"] })}
    >
      <option value="">Todos</option>
      <option value="true">Marcados</option>
      <option value="false">Sin marcar</option>
    </Select>
  );
}

function CustomerFavoriteSelect({ value, onChange, wrapperClassName }: SharedFieldProps) {
  return (
    <Select
      label="Favorita"
      wrapperClassName={wrapperClassName}
      value={value.isCustomerFavorite}
      onChange={(event) =>
        onChange({ ...value, isCustomerFavorite: event.target.value as CatalogFiltersValue["isCustomerFavorite"] })
      }
    >
      <option value="">Todos</option>
      <option value="true">Marcados</option>
      <option value="false">Sin marcar</option>
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
 * Only the filters `adminProductListQuerySchema` actually accepts
 * (`apps/api/src/validators/list-query.validator.ts`) — no control that the
 * backend would silently ignore.
 *
 * Below `md`: `Buscar` stays visible full-width next to a `Filtros` button
 * (badge shows the active count) that opens the other four controls in a
 * `SlideOver` — reused as-is, its `w-full max-w-[480px]` is already
 * full-screen at 430px and already brings focus trap, `Escape`, and
 * `role="dialog"`. `md:` and up: the original single inline row, unchanged.
 */
export function CatalogFilters({ value, onChange, categoryTree, brands }: CatalogFiltersProps) {
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
          wrapperClassName="flex-1 md:flex-none"
        />
        <Button variant="ghost" onClick={() => setSheetOpen(true)} className="md:hidden">
          <Funnel size={18} aria-hidden="true" />
          Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
      </div>

      <div className="hidden md:contents">
        <CategorySelect value={value} onChange={onChange} categoryTree={categoryTree} />
        <BrandSelect value={value} onChange={onChange} brands={brands} />
        <StatusSelect value={value} onChange={onChange} />
        <NewArrivalSelect value={value} onChange={onChange} />
        <CustomerFavoriteSelect value={value} onChange={onChange} />
        <SortSelect value={value} onChange={onChange} />
      </div>

      <SlideOver
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filtros"
        footer={
          <>
            <Button variant="ghost" onClick={() => onChange({ ...DEFAULT_FILTERS, search: value.search })}>
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
          <StatusSelect value={value} onChange={onChange} wrapperClassName="w-full" />
          <NewArrivalSelect value={value} onChange={onChange} wrapperClassName="w-full" />
          <CustomerFavoriteSelect value={value} onChange={onChange} wrapperClassName="w-full" />
          <SortSelect value={value} onChange={onChange} wrapperClassName="w-full" />
        </div>
      </SlideOver>
    </div>
  );
}
