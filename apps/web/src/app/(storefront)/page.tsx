import { HomeBrands } from "@/components/storefront/brands/HomeBrands";
import { HomeCategories } from "@/components/storefront/categories/HomeCategories";
import { HomeHero } from "@/components/storefront/hero/HomeHero";
import { HomeNewProducts } from "@/components/storefront/products/HomeNewProducts";

/**
 * The home page (M12). Entrega 5 adds "Novedades" (a mixed bikes+accessories
 * rail, curated via `Bike.isNewArrival`/`Accessory.isNewArrival`) after the
 * entrega 4 brand marquee — this replaces the "bestseller" section originally
 * planned here (see `docs/MILESTONES.md` M12 entrega 5 for why). Four
 * sections remain (comprar bicis/accesorios, favoritos de los clientes,
 * descubre tu bici, sucursal, footer), each its own entrega.
 */
export default function HomePage() {
  return (
    <>
      <HomeHero />
      <HomeCategories />
      <HomeBrands />
      <HomeNewProducts />

      <div className="flex min-h-[50vh] items-center justify-center px-md py-3xl text-center">
        <p className="font-ui text-ui text-grafito">La página de inicio se construye sección por sección — vuelve pronto.</p>
      </div>
    </>
  );
}
