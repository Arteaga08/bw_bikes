import { HomeBikeOfMonth } from "@/components/storefront/bike-of-month/HomeBikeOfMonth";
import { HomeBrands } from "@/components/storefront/brands/HomeBrands";
import { HomeCategories } from "@/components/storefront/categories/HomeCategories";
import { HomeCategoryCtas } from "@/components/storefront/category-ctas/HomeCategoryCtas";
import { HomeHero } from "@/components/storefront/hero/HomeHero";
import { HomeFavoriteProducts } from "@/components/storefront/products/HomeFavoriteProducts";
import { HomeNewProducts } from "@/components/storefront/products/HomeNewProducts";

/**
 * The home page (M12). Entrega 6 added "comprar bicis/accesorios" (two photo
 * CTA tiles, `HomeCategoryCtas`) after "Novedades"; this entrega adds "bici
 * del mes" (`HomeBikeOfMonth`), a single full-bleed spotlight banner, right
 * after it. This entrega adds "favoritas de los ciclistas"
 * (`HomeFavoriteProducts`), the same product rail as "Novedades" against the
 * `isCustomerFavorite` flag. Remaining sections (descubre tu bici, sucursal,
 * footer), each its own entrega.
 */
export default function HomePage() {
  return (
    <>
      <HomeHero />
      <HomeCategories />
      <HomeBrands />
      <HomeNewProducts />
      <HomeCategoryCtas />
      <HomeBikeOfMonth />
      <HomeFavoriteProducts />

      <div className="flex min-h-[50vh] items-center justify-center px-md py-3xl text-center">
        <p className="font-ui text-ui text-grafito">
          La página de inicio se construye sección por sección — vuelve pronto.
        </p>
      </div>
    </>
  );
}
