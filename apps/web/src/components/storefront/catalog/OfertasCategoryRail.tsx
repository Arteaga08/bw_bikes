"use client";

import type { PublicCategoryTreeNode } from "@bw-bikes/shared";
import { CategoryCard } from "@/components/storefront/categories/CategoryCard";
import { ScrollRail } from "@/components/storefront/shared/ScrollRail";

export interface OfertasCategoryRailProps {
  bikeCategories: PublicCategoryTreeNode[];
  accessoryCategories: PublicCategoryTreeNode[];
}

/**
 * The category row under "Ofertas"' cover — same compact `ScrollRail` tiles
 * as `CatalogCategoryRail`, but spanning both catalogs in one rail: bike
 * categories first, then accessory categories. Each tile links to
 * `/ofertas?category={id}`, Manuel's call, 2026-09-03: a tap here should land
 * on that category's *discounted* products, not the full catalog category
 * (`/bicicletas/[slug]`/`/accesorios/[slug]`), which also lists items with no
 * offer. `category.id`, not `slug` — the "Categoría" filter's query param
 * takes the Mongo id (`CatalogFilterState.categories`,
 * `storefront-catalog-filters.ts`), same as the sidebar checkboxes.
 *
 * No synthetic "Todos" tile, unlike `CatalogCategoryRail`: there's no single
 * catalog root this rail belongs to, so there's nothing for it to point back
 * at — clearing the filter is what the "Ofertas" nav link itself already
 * does.
 */
export function OfertasCategoryRail({ bikeCategories, accessoryCategories }: OfertasCategoryRailProps) {
  return (
    <div className="sm:-ml-xl">
      <ScrollRail
        ariaLabel="Categorías de ofertas"
        previousLabel="Categorías anteriores"
        nextLabel="Siguientes categorías"
        gutter="page"
      >
        {bikeCategories.map((category) => (
          <CategoryCard key={category.id} category={category} href={`/ofertas?category=${category.id}`} size="compact" />
        ))}
        {accessoryCategories.map((category) => (
          <CategoryCard key={category.id} category={category} href={`/ofertas?category=${category.id}`} size="compact" />
        ))}
      </ScrollRail>
    </div>
  );
}
