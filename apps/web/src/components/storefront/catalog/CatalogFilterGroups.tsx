"use client";

import type { PublicCatalogFilterOptions, PublicCategoryTreeNode } from "@bw-bikes/shared";
import { Checkbox } from "@/components/ui/Checkbox";
import { useCatalogFilters } from "@/hooks/use-catalog-filters";
import { CatalogFilterCheckboxList } from "./CatalogFilterCheckboxList";
import { CatalogFilterColorGrid } from "./CatalogFilterColorGrid";
import { CatalogFilterGroup } from "./CatalogFilterGroup";
import { CatalogFilterPriceRange } from "./CatalogFilterPriceRange";

export interface CatalogFilterGroupsProps {
  categoryTree: PublicCategoryTreeNode[];
  options: PublicCatalogFilterOptions;
  /** Set on a `/[slug]` category page — the route already fixes the category, so the sidebar's own Categoría group would just be a second, unpreselected way to pick what's already decided. */
  hideCategoryFilter?: boolean;
  /** The category a `/[slug]` page fixed via its route (`category.id` there) — lets "Grupo" still offer that one category's own subcategories even with "Categoría" itself hidden. Ignored when `hideCategoryFilter` isn't set. */
  fixedCategoryId?: string;
}

/**
 * The filter sidebar's actual content, in a fixed order: Categoría → Grupo
 * → Marca → Talla → Precio → Color → Destacados → each ficha-técnica group
 * an admin turned on. Shared by `CatalogFilterSidebar` (desktop) and
 * `CatalogFilterDrawer` (mobile) so the two surfaces can never disagree on
 * which filters exist — both just wrap this in their own chrome.
 *
 * A group whose options list is empty renders nothing at all rather than an
 * empty accordion — same "degrade to absence, not to a broken control"
 * contract `CatalogHeader` already follows for its category rail.
 */
export function CatalogFilterGroups({
  categoryTree,
  options,
  hideCategoryFilter,
  fixedCategoryId,
}: CatalogFilterGroupsProps) {
  const { filters, setFilters } = useCatalogFilters();

  const rootCategories = categoryTree.map((category) => ({ value: category.id, label: category.name }));
  // Which root(s) "Grupo" should read children from: on a `/[slug]` page
  // it's always the route's own fixed category (there's no "Categoría" list
  // to check a different one from); everywhere else it's whatever the
  // shopper actually checked. "Grupo" stays absent until one of those has
  // children, instead of every root's children pooled together.
  const activeCategoryIds = hideCategoryFilter ? (fixedCategoryId ? [fixedCategoryId] : []) : filters.categories;
  const childCategories = categoryTree
    .filter((category) => activeCategoryIds.includes(category.id))
    .flatMap((category) => category.children)
    .map((category) => ({ value: category.id, label: category.name }));

  return (
    <div className="flex flex-col">
      {!hideCategoryFilter && rootCategories.length > 0 ? (
        <CatalogFilterGroup title="Categoría" defaultOpen>
          <CatalogFilterCheckboxList
            options={rootCategories}
            selected={filters.categories}
            onChange={(categories) => setFilters({ ...filters, categories })}
          />
        </CatalogFilterGroup>
      ) : null}

      {childCategories.length > 0 ? (
        // No `key` needed to force the fresh-mount `defaultOpen` below: the
        // group already unmounts/remounts on this branch's own condition
        // each time `childCategories` goes empty <-> non-empty.
        <CatalogFilterGroup title="Grupo" defaultOpen>
          <CatalogFilterCheckboxList
            options={childCategories}
            selected={filters.categories}
            onChange={(categories) => setFilters({ ...filters, categories })}
          />
        </CatalogFilterGroup>
      ) : null}

      {options.brands.length > 0 ? (
        <CatalogFilterGroup title="Marca" defaultOpen>
          <CatalogFilterCheckboxList
            options={options.brands.map((brand) => ({ value: brand.slug, label: brand.name }))}
            selected={filters.brands}
            onChange={(brands) => setFilters({ ...filters, brands })}
          />
        </CatalogFilterGroup>
      ) : null}

      {options.sizes.length > 0 ? (
        <CatalogFilterGroup title="Talla">
          <CatalogFilterCheckboxList
            options={options.sizes.map((size) => ({ value: size, label: size }))}
            selected={filters.sizes}
            onChange={(sizes) => setFilters({ ...filters, sizes })}
          />
        </CatalogFilterGroup>
      ) : null}

      <CatalogFilterGroup title="Precio">
        <CatalogFilterPriceRange
          minPrice={filters.minPrice}
          maxPrice={filters.maxPrice}
          bounds={options.price}
          onChange={(minPrice, maxPrice) => setFilters({ ...filters, minPrice, maxPrice })}
        />
      </CatalogFilterGroup>

      {options.colors.length > 0 ? (
        <CatalogFilterGroup title="Color">
          <CatalogFilterColorGrid
            options={options.colors}
            selected={filters.colors}
            onChange={(colors) => setFilters({ ...filters, colors })}
          />
        </CatalogFilterGroup>
      ) : null}

      <CatalogFilterGroup title="Destacados">
        <div className="flex flex-col gap-sm">
          <Checkbox
            label="Novedades"
            checked={filters.isNewArrival}
            onChange={(event) => setFilters({ ...filters, isNewArrival: event.target.checked })}
          />
          <Checkbox
            label="Favoritas de los ciclistas"
            checked={filters.isCustomerFavorite}
            onChange={(event) => setFilters({ ...filters, isCustomerFavorite: event.target.checked })}
          />
        </div>
      </CatalogFilterGroup>

      {options.specs.map((group) => (
        <CatalogFilterGroup key={group.label} title={group.label}>
          <CatalogFilterCheckboxList
            options={group.values.map((value) => ({ value, label: value }))}
            selected={filters.specs[group.label] ?? []}
            onChange={(values) =>
              setFilters({ ...filters, specs: { ...filters.specs, [group.label]: values } })
            }
          />
        </CatalogFilterGroup>
      ))}
    </div>
  );
}
