import type { Metadata } from "next";
import { CatalogHero } from "@/components/storefront/catalog/CatalogHero";
import { CATALOG_EYEBROW, OFFERS_COVER } from "@/lib/storefront-catalog";

export const metadata: Metadata = {
  title: "Ofertas",
  description: "Rebajas vigentes de bicicletas Black and White Bikes.",
};

/**
 * Solo la portada: Ofertas no tiene árbol de categorías propio ni filtro
 * backend de "en oferta" (`publicProductListQuerySchema` no acepta ese query
 * param, ya documentado en `storefront-mega-menu.ts`), así que no hay fila de
 * categorías que mostrar ni listado real que renderizar todavía.
 */
export default function OfertasPage() {
  return (
    <>
      <CatalogHero image={OFFERS_COVER} eyebrow={CATALOG_EYEBROW} title="Ofertas" />
      <p className="px-lg py-3xl text-center font-body text-body text-grafito sm:px-[clamp(2rem,8vw,8rem)]">
        El listado de rebajas llega en un paso siguiente.
      </p>
    </>
  );
}
