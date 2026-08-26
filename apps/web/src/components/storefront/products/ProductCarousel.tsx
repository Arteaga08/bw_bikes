"use client";

import type { PublicProductSummary } from "@/lib/api/public-catalog";
import { ScrollRail } from "@/components/storefront/shared/ScrollRail";
import { ProductCard } from "./ProductCard";

export interface ProductCarouselProps {
  products: PublicProductSummary[];
  /** Spanish labels, passed in by the section: two home rails ("Novedades", "Favoritas de los ciclistas") share this component and must not announce each other's name. */
  ariaLabel: string;
  previousLabel: string;
  nextLabel: string;
}

/** A product rail — the product-catalog counterpart to `CategoryCarousel`, same `ScrollRail` underneath. */
export function ProductCarousel({ products, ariaLabel, previousLabel, nextLabel }: ProductCarouselProps) {
  return (
    <ScrollRail ariaLabel={ariaLabel} previousLabel={previousLabel} nextLabel={nextLabel}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </ScrollRail>
  );
}
