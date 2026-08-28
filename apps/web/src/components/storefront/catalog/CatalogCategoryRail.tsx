"use client";

import type { PublicCategoryTreeNode } from "@bw-bikes/shared";
import { CategoryCard } from "@/components/storefront/categories/CategoryCard";
import { ScrollRail } from "@/components/storefront/shared/ScrollRail";
import type { CatalogKind } from "@/lib/storefront-catalog";

export interface CatalogCategoryRailProps {
  catalog: CatalogKind;
  categories: PublicCategoryTreeNode[];
  activeSlug?: string;
}

const RAIL_COPY: Record<CatalogKind, { basePath: string; ariaLabel: string; previousLabel: string; nextLabel: string }> = {
  bike: {
    basePath: "/bicicletas",
    ariaLabel: "Categorías de bicicletas",
    previousLabel: "Categorías anteriores",
    nextLabel: "Siguientes categorías",
  },
  accessory: {
    basePath: "/accesorios",
    ariaLabel: "Categorías de accesorios",
    previousLabel: "Categorías anteriores",
    nextLabel: "Siguientes categorías",
  },
};

/**
 * The category row under a catalog cover. Same `ScrollRail` mechanics as the
 * home's `CategoryCarousel`, with two differences that come from the job it
 * does here: the tiles are `compact` (this is navigation sitting under a
 * cover, not the section's own content), and `gutter="page"` lines the first
 * tile up with `CatalogHero`'s title instead of pulling out to a near-full-
 * bleed edge.
 *
 * No heading above it, deliberately. On the home the rail is a merchandising
 * section and earns "Explorar Bicicletas"; here it continues the cover the
 * visitor is already looking at, and a heading would only restate it.
 */
export function CatalogCategoryRail({ catalog, categories, activeSlug }: CatalogCategoryRailProps) {
  const copy = RAIL_COPY[catalog];

  return (
    <ScrollRail
      ariaLabel={copy.ariaLabel}
      previousLabel={copy.previousLabel}
      nextLabel={copy.nextLabel}
      gutter="page"
    >
      {categories.map((category) => (
        <CategoryCard
          key={category.id}
          category={category}
          basePath={copy.basePath}
          size="compact"
          isActive={category.slug === activeSlug}
        />
      ))}
    </ScrollRail>
  );
}
