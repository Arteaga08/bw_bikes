import { HomeHero } from "@/components/storefront/hero/HomeHero";

/**
 * The home page (M12). Entrega 2 replaces the entrega 1 placeholder with the
 * real hero — the other eight sections (tipo de bicis, banner de marca,
 * bestseller, comprar bicis/accesorios, favoritos de los clientes, descubre
 * tu bici, sucursal, footer) are still to come, each its own entrega — see
 * `docs/MILESTONES.md` M12 for the plan.
 */
export default function HomePage() {
  return (
    <>
      <HomeHero />

      {/* `min-h-screen`, not a shorter block: entrega 1's own note on why the
          scrollable distance below the hero needs to stay generous for the
          navbar's transparent→solid transition to be demonstrable. */}
      <div className="flex min-h-screen items-center justify-center px-md py-3xl text-center">
        <p className="font-ui text-ui text-grafito">La página de inicio se construye sección por sección — vuelve pronto.</p>
      </div>
    </>
  );
}
