import type { PublicCatalogFilterOptions } from "@bw-bikes/shared";

/** First occurrence wins for a given key — order across the merge stays "every value from `a`, then whatever `b` adds that `a` didn't already have". */
function dedupeBy<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const value of values) {
    const k = key(value);
    if (seen.has(k)) continue;
    seen.add(k);
    result.push(value);
  }
  return result;
}

/**
 * Combines two catalogs' filter vocabularies into one — "Ofertas" mixes
 * bikes and accessories in a single grid, so its sidebar needs one merged
 * set of brands/sizes/colors/price instead of picking just one catalog's.
 * `specs` comes back empty on purpose: a bike's and an accessory's ficha
 * técnica share no vocabulary, so there's nothing meaningful to merge —
 * `CatalogFilterGroups` already renders no "ficha técnica" groups at all
 * when `specs` is empty, same as it does for any catalog with none turned on.
 */
export function mergeCatalogFilterOptions(
  a: PublicCatalogFilterOptions,
  b: PublicCatalogFilterOptions,
): PublicCatalogFilterOptions {
  const brands = dedupeBy([...a.brands, ...b.brands], (brand) => brand.slug);
  const sizes = dedupeBy([...a.sizes, ...b.sizes], (size) => size);
  const colors = dedupeBy([...a.colors, ...b.colors], (color) => color.value);

  const price =
    a.price && b.price
      ? { min: Math.min(a.price.min, b.price.min), max: Math.max(a.price.max, b.price.max) }
      : (a.price ?? b.price);

  return { brands, sizes, colors, price, specs: [] };
}
