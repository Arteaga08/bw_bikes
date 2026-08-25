import type { PublicProductSummary } from "@/lib/api/public-catalog";

/**
 * The one function that knows a product's PDP URL. Placeholder until the PDP
 * exists (M12's own plan lists `/bicicletas`, `/accesorios` as out of scope
 * for entrega 4 — this rail ships before them too): today it 404s, same as
 * the hero's CTAs and `CategoryCard`'s links already do. When the PDP lands,
 * this is the only place that needs to change.
 *
 * `/producto/` is a fixed segment, deliberately not the category slug — that
 * one is already spoken for by `/bicicletas/[categorySlug]`
 * (`CategoryCard`), and a product slug isn't guaranteed unique across it.
 */
export function productHref(product: Pick<PublicProductSummary, "kind" | "slug">): string {
  const catalogSegment = product.kind === "bike" ? "bicicletas" : "accesorios";
  return `/${catalogSegment}/producto/${product.slug}`;
}
