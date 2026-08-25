import { getPublicBrands } from "@/lib/api/public-catalog";
import { ApiError } from "@/lib/api/error";
import { BrandMarquee } from "./BrandMarquee";

/**
 * Server Component: el marquee de marcas del home ("banner de marca", M12
 * entrega 4/10), entre "Explorar Bicicletas" (`HomeCategories`) y la
 * siguiente entrega. Primera sección oscura de la home — `HomeHero` y
 * `HomeCategories` corren sobre `bg-base`; acá se rompe deliberadamente ese
 * ritmo de "card stack claro" (decisión de diseño confirmada vía la skill
 * `impeccable`).
 *
 * Mismo contrato de degradación que `HomeCategories`: una marca sin `logo`
 * subido no aparece — el admin controla el contenido subiendo el logo,
 * nada más lo gatilla. Si ninguna marca activa tiene logo, la sección
 * entera no se renderiza (nunca una banda negra vacía).
 */
export async function HomeBrands() {
  let brands: Awaited<ReturnType<typeof getPublicBrands>> = [];
  try {
    brands = await getPublicBrands();
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    brands = [];
  }

  const brandsWithLogo = brands.filter((brand) => brand.logo);
  if (brandsWithLogo.length === 0) return null;

  return (
    <section className="bg-overlay py-3xl">
      <BrandMarquee brands={brandsWithLogo} />
    </section>
  );
}
