export interface StorefrontNavItem {
  label: string;
  href: string;
}

/**
 * The public site's own nav list — the counterpart to `lib/nav.ts` (admin).
 * Kept separate on purpose: the two have nothing in common (no roles, no
 * icons, no sections) and the admin's sidebar has zero business rendering on
 * `/`.
 *
 * Revised after the Orbea-referenced navbar redesign (M12 entrega 1, ronda
 * 2): "Eléctricas" and "Compromiso" come out of the primary nav — Eléctricas
 * fits as a category filter inside Bicicletas once that tree exists;
 * Compromiso moves to the footer (entrega 10). "Ofertas" replaces the
 * mockup's placeholder fourth slot.
 *
 * `/bicicletas`, `/accesorios` and `/ofertas` are catalog routes this
 * entrega doesn't build yet — they 404 until then, the same as any link to a
 * page that hasn't shipped. "Ofertas" additionally has no backend filter yet
 * even once the catalog route exists: `compareAtPrice` is on the public DTO,
 * but `publicProductListQuerySchema` (`apps/api/src/validators/`) doesn't
 * accept an "on sale" query param — that's new API work for whichever
 * entrega builds the page behind this link.
 */
export const STOREFRONT_NAV_ITEMS: readonly StorefrontNavItem[] = [
  { label: "Bicicletas", href: "/bicicletas" },
  { label: "Accesorios", href: "/accesorios" },
  { label: "Ofertas", href: "/ofertas" },
];

/**
 * Prefix match against an item's route. Mirrors `Sidebar`'s `isItemActive`
 * (admin): a sub-route like a product page under `/bicicletas/:slug` should
 * still mark "Bicicletas" current. The `href.split("?")` guard against a
 * query string stays even though no current item carries one — cheap
 * insurance against a future item that does (the previous "Eléctricas" was
 * exactly that case).
 */
export function isStorefrontNavItemActive(pathname: string, href: string): boolean {
  const route = href.split("?")[0]!;
  return pathname === route || pathname.startsWith(`${route}/`);
}
