"use client";

import type { PublicCategoryTreeNode } from "@bw-bikes/shared";
import { CategoryCard } from "@/components/storefront/categories/CategoryCard";
import { ScrollRail } from "@/components/storefront/shared/ScrollRail";
import { getCatalogCopy, type CatalogKind } from "@/lib/storefront-catalog";

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
 * Synthetic first tile, not a real category — there's no `/:kind-categories`
 * entry for "every product in this catalog," so there's nothing in `tree` to
 * render it from. Reuses the catalog's own fixed cover (`getCatalogCopy`,
 * the same placeholder `CatalogHero` falls back to) rather than asking an
 * admin to manage a dedicated image for a link that isn't a category. `slug`
 * and the rest of `PublicCategory`'s required fields are unused filler —
 * `href` on `CategoryCard` overrides the `basePath/slug` link this would
 * otherwise produce.
 */
function buildAllCategoriesNode(catalog: CatalogKind): PublicCategoryTreeNode {
  const { cover } = getCatalogCopy(catalog);
  return {
    id: "__all__",
    name: "Todos",
    slug: "",
    parent: null,
    order: -1,
    usesSizes: false,
    image: { publicId: "", url: cover.url, alt: cover.alt, width: 0, height: 0 },
    children: [],
  };
}

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
 *
 * Always leads with a synthetic "Todos" tile (`buildAllCategoriesNode`) ahead
 * of the real categories — Manuel's call, 2026-09-03: with every category
 * shown, there was no way back to the unfiltered catalog once on a `/[slug]`
 * page except the browser's own Back button.
 *
 * The `sm:-ml-xl` wrapper nudges the whole rail (tiles, arrows, progress bar
 * — everything lives inside `ScrollRail`'s own `group/rail` box, so a margin
 * on this outer div moves it as one piece) left of `gutter="page"`'s inset.
 * Manuel's call, 2026-09-03: he wants the rail sitting closer to the edge
 * than the hero title above it, not sharing its exact left edge — so this
 * intentionally breaks the alignment `CatalogHero`'s own comment describes,
 * rather than moving both.
 */

export function CatalogCategoryRail({ catalog, categories, activeSlug }: CatalogCategoryRailProps) {
  const copy = RAIL_COPY[catalog];
  const allCategoriesNode = buildAllCategoriesNode(catalog);

  return (
    <div className="sm:-ml-xl">
      <ScrollRail
        ariaLabel={copy.ariaLabel}
        previousLabel={copy.previousLabel}
        nextLabel={copy.nextLabel}
        gutter="page"
      >
        <CategoryCard
          key={allCategoriesNode.id}
          category={allCategoriesNode}
          basePath={copy.basePath}
          href={copy.basePath}
          size="compact"
          isActive={!activeSlug}
        />
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
    </div>
  );
}
