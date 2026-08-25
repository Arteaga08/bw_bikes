"use client";

import type { PublicProductSummary } from "@/lib/api/public-catalog";
import { ScrollRail } from "@/components/storefront/shared/ScrollRail";
import { ProductCard } from "./ProductCard";

export interface ProductCarouselProps {
  products: PublicProductSummary[];
}

/** The "Novedades" rail — the product-catalog counterpart to `CategoryCarousel`, same `ScrollRail` underneath. */
export function ProductCarousel({ products }: ProductCarouselProps) {
  return (
    <ScrollRail ariaLabel="Novedades" previousLabel="Novedades anteriores" nextLabel="Siguientes novedades">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </ScrollRail>
  );
}
