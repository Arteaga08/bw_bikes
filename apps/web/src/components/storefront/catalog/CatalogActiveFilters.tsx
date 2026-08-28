"use client";

import type { PublicCatalogFilterOptions, PublicCategoryTreeNode } from "@bw-bikes/shared";
import { useCatalogFilters } from "@/hooks/use-catalog-filters";
import { DEFAULT_FILTER_STATE, removeFilterChip, toFilterChips } from "@/lib/storefront-catalog-filters";
import { CatalogFilterChips } from "./CatalogFilterChips";

export interface CatalogActiveFiltersProps {
  categoryTree: PublicCategoryTreeNode[];
  options: PublicCatalogFilterOptions;
}

/**
 * The active-filter chip row for the results column — deliberately **not**
 * inside `CatalogFilterSidebar`, which is `hidden` below `lg`: a shopper who
 * picked filters from `CatalogFilterDrawer` on mobile needs the same
 * feedback and the same one-click removal a desktop shopper gets, so this
 * renders at every width, right above the product grid (still the
 * placeholder paragraph, until the grid ships).
 */
export function CatalogActiveFilters({ categoryTree, options }: CatalogActiveFiltersProps) {
  const { filters, setFilters } = useCatalogFilters();

  const chipContext = {
    categories: [
      ...categoryTree.map((category) => ({ id: category.id, name: category.name })),
      ...categoryTree.flatMap((category) => category.children).map((category) => ({ id: category.id, name: category.name })),
    ],
    brands: options.brands.map((brand) => ({ slug: brand.slug, name: brand.name })),
  };
  const chips = toFilterChips(filters, chipContext);

  if (chips.length === 0) return null;

  return (
    <div className="mb-lg">
      <CatalogFilterChips
        chips={chips}
        onRemove={(key) => setFilters(removeFilterChip(filters, key))}
        onClearAll={() => setFilters(DEFAULT_FILTER_STATE)}
      />
    </div>
  );
}
