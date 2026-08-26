"use client";

import type { PublicCategoryTreeNode } from "@bw-bikes/shared";
import { ScrollRail } from "@/components/storefront/shared/ScrollRail";
import { CategoryCard } from "./CategoryCard";

export interface CategoryCarouselProps {
  categories: PublicCategoryTreeNode[];
}

/**
 * The category rail — a thin wrapper over `ScrollRail` (the mechanics: native
 * scroll, snap, arrows, progress) supplying the tiles and the Spanish labels.
 * See `ScrollRail`'s own doc comment for why this is built on native scroll
 * rather than a translate-based track.
 */
export function CategoryCarousel({ categories }: CategoryCarouselProps) {
  return (
    <ScrollRail
      ariaLabel="Categorías de bicicletas"
      previousLabel="Categorías anteriores"
      nextLabel="Siguientes categorías"
      gutter="tight"
    >
      {categories.map((category) => (
        <CategoryCard key={category.id} category={category} />
      ))}
    </ScrollRail>
  );
}
