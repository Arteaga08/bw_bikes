import type { PublicProductSummary } from "@/lib/api/public-catalog";

/**
 * The one function that knows a product's PDP URL — `/bicicletas/producto/
 * [slug]` and `/accesorios/producto/[slug]` both exist and render real
 * product pages.
 *
 * `/producto/` is a fixed segment, deliberately not the category slug — that
 * one is already spoken for by `/bicicletas/[categorySlug]`
 * (`CategoryCard`), and a product slug isn't guaranteed unique across it.
 */
export function productHref(product: Pick<PublicProductSummary, "kind" | "slug">): string {
  const catalogSegment = product.kind === "bike" ? "bicicletas" : "accesorios";
  return `/${catalogSegment}/producto/${product.slug}`;
}
