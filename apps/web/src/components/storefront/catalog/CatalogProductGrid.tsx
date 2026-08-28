import type { PublicColorSwatch, PublicProductSummary } from "@/lib/api/public-catalog";
import { cn } from "@/lib/cn";
import { CatalogProductCard } from "./CatalogProductCard";

export interface CatalogProductGridProps {
  products: PublicProductSummary[];
  colorSwatchIndex: Map<string, PublicColorSwatch>;
  /** Spanish copy for the empty state — the caller knows whether this is a whole catalog or one category, this component doesn't branch on that. */
  emptyMessage: string;
  /** Set when a caller already owns the page's horizontal gutter — the filter sidebar's results column applies `px-lg sm:px-[clamp(2rem,8vw,8rem)]` once on its own wrapper, at every breakpoint, so the grid underneath doesn't double it on top of the sidebar's own gap. */
  noGutter?: boolean;
}

const GUTTER = "px-lg sm:px-[clamp(2rem,8vw,8rem)]";

/**
 * "De tres en tres" (Manuel's brief): one column on mobile, two on tablet,
 * three on desktop — `lg:grid-cols-3` is the step that reads as three per
 * row. Same page gutters as the marker paragraph these pages replace
 * (`px-lg sm:px-[clamp(2rem,8vw,8rem)]`), unless `noGutter` says a parent
 * already provides them.
 *
 * Callers do the fetching (`CatalogProductSection`); this component only
 * ever lays out what it's handed, same split `ProductCarousel`/`ProductCard`
 * already keep between data and layout.
 */
export function CatalogProductGrid({ products, colorSwatchIndex, emptyMessage, noGutter }: CatalogProductGridProps) {
  if (products.length === 0) {
    return (
      <p className={cn("py-3xl text-center font-body text-body text-grafito", !noGutter && GUTTER)}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className={cn("grid grid-cols-1 gap-lg py-xl sm:grid-cols-2 lg:grid-cols-3", !noGutter && GUTTER)}>
      {products.map((product) => (
        <CatalogProductCard key={product.id} product={product} colorSwatchIndex={colorSwatchIndex} />
      ))}
    </div>
  );
}
