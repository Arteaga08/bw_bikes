/**
 * `product.name` arrives with the brand baked in ("Trek Verve+ 2"). Wherever
 * the brand already shows on its own — the eyebrow above `ProductInfo`'s
 * title — repeating it in the title is noise.
 *
 * Shared by `ProductInfo` (el carril lateral) and `ProductOverview` (la
 * sección de abajo), which paint the same title twice and must strip it
 * identically. `CatalogProductCard` keeps its own copy for now: it works off
 * `PublicProductSummary`, a different shape.
 */
export function stripBrandFromName(name: string, brandName: string): string {
  const brand = brandName.trim();
  if (!brand || !name.toLocaleLowerCase("es").startsWith(brand.toLocaleLowerCase("es"))) return name;

  // Only strip on a word boundary, so a brand that prefixes a longer word
  // ("Trek" in "Trekking Pro") isn't eaten.
  const nextChar = name.charAt(brand.length);
  if (nextChar !== "" && !/\s/.test(nextChar)) return name;

  const rest = name.slice(brand.length).trimStart();
  return rest.length > 0 ? rest : name;
}
