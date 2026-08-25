import { HomeCategories } from "@/components/storefront/categories/HomeCategories";
import { HomeHero } from "@/components/storefront/hero/HomeHero";

/**
 * The home page (M12). Entrega 3 adds "Explorar bicis" (category rail) after
 * the entrega 2 hero — six sections remain (banner de marca, bestseller,
 * comprar bicis/accesorios, favoritos de los clientes, descubre tu bici,
 * sucursal, footer), each its own entrega — see `docs/MILESTONES.md` M12 for
 * the plan.
 */
export default function HomePage() {
  return (
    <>
      <HomeHero />
      <HomeCategories />

      <div className="flex min-h-[50vh] items-center justify-center px-md py-3xl text-center">
        <p className="font-ui text-ui text-grafito">La página de inicio se construye sección por sección — vuelve pronto.</p>
      </div>
    </>
  );
}
