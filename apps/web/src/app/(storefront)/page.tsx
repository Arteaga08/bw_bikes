import { Suspense } from "react";
import { HomeBikeOfMonth } from "@/components/storefront/bike-of-month/HomeBikeOfMonth";
import { HomeBranchCtas } from "@/components/storefront/branch/HomeBranchCtas";
import { HomeBrands } from "@/components/storefront/brands/HomeBrands";
import { HomeCategories } from "@/components/storefront/categories/HomeCategories";
import { HomeCategoryCtas } from "@/components/storefront/category-ctas/HomeCategoryCtas";
import { HomeComparatorBanner } from "@/components/storefront/comparator/HomeComparatorBanner";
import { HomeHero } from "@/components/storefront/hero/HomeHero";
import { HomeBestSellingAccessories } from "@/components/storefront/products/HomeBestSellingAccessories";
import { HomeFavoriteProducts } from "@/components/storefront/products/HomeFavoriteProducts";
import { HomeNewProducts } from "@/components/storefront/products/HomeNewProducts";

/**
 * The home page (M12). Entrega 6 added "comprar bicis/accesorios" (two photo
 * CTA tiles, `HomeCategoryCtas`) after "Novedades"; this entrega adds "bici
 * del mes" (`HomeBikeOfMonth`), a single full-bleed spotlight banner, right
 * after it. This entrega adds "favoritas de los ciclistas"
 * (`HomeFavoriteProducts`), the same product rail as "Novedades" against the
 * `isCustomerFavorite` flag. This entrega replaces the planned "descubre tu
 * bici" quiz with `HomeComparatorBanner` — a mirrored spotlight banner into
 * the `/comparar` page — because the catalog has no structured terrain or
 * discipline field for a quiz to match on. This entrega separates bikes and
 * accessories instead of continuing to mix them: "Novedades" is now
 * bikes-only, and "Accesorios más vendidos" (`HomeBestSellingAccessories`)
 * closes the page with the accessory side of that same `isNewArrival` flag.
 * This entrega adds "sucursal" (`HomeBranchCtas`), the same two-tile photo
 * CTA grammar as `HomeCategoryCtas` but pointing off-site (Google Maps,
 * WhatsApp) instead of into the catalog. Closing entrega (10/10): the footer
 * — it lives in `(storefront)/layout.tsx`, not here, since it's global
 * chrome shared by every route, not a home-only section. That was the last
 * section on the list; the home is no longer "under construction" past this
 * point.
 *
 * `HomeHero`/`HomeCategories` (the first fold) are left unwrapped on
 * purpose: without any `<Suspense>` boundary at all, Next holds the entire
 * response until every fetch on the page resolves, so wrapping *everything*
 * would only mean the two above-the-fold sections wait on the slowest
 * below-the-fold one for no reason. Every section from `HomeBrands` down —
 * each with its own independent fetch — streams in behind its own boundary
 * once ready, instead of holding up the two the visitor sees first
 * (M-optimización). `HomeBranchCtas` stays outside `Suspense` too: it fetches
 * nothing (its links are static), so there's nothing there to stream.
 */
export default function HomePage() {
  return (
    <>
      <HomeHero />
      <HomeCategories />
      <Suspense fallback={null}>
        <HomeBrands />
      </Suspense>
      <Suspense fallback={null}>
        <HomeNewProducts />
      </Suspense>
      <Suspense fallback={null}>
        <HomeCategoryCtas />
      </Suspense>
      <Suspense fallback={null}>
        <HomeBikeOfMonth />
      </Suspense>
      <Suspense fallback={null}>
        <HomeFavoriteProducts />
      </Suspense>
      <Suspense fallback={null}>
        <HomeComparatorBanner />
      </Suspense>
      <Suspense fallback={null}>
        <HomeBestSellingAccessories />
      </Suspense>
      <HomeBranchCtas />
    </>
  );
}
