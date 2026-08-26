import Image from "next/image";
import { PromoBanner } from "@/components/storefront/shared/PromoBanner";
import { ApiError } from "@/lib/api/error";
import { getComparatorBannerImage } from "@/lib/api/public-catalog";

/**
 * The home's entry point into `/comparar` (M12) — the same spotlight banner
 * as "bici del mes", mirrored: copy and buttons anchor to the right edge
 * instead of the left, so two full-bleed banners on one page don't read as
 * the same block repeated.
 *
 * The eyebrow carries the rhino, matching "bici del mes" right above it —
 * two adjacent banners with the same layout and a different eyebrow grammar
 * read as a mistake. Worth knowing: DESIGN_SYSTEM.md §5.1 caps the home at
 * two rhino appearances, and the page was already well past that before this
 * section existed (hero slides, both category tiles, bici del mes, the
 * mobile menu). Manuel's call, 2026-08-26 — the rule needs revisiting
 * against the built page, not this one section held to it alone.
 *
 * A single action, not the pair "bici del mes" carries: the second button
 * there is a second route to the same product, while everything this section
 * offers is the comparator itself. A "ver bicicletas" companion would point
 * at `/bicicletas`, which doesn't exist yet.
 */
export async function HomeComparatorBanner() {
  let image: Awaited<ReturnType<typeof getComparatorBannerImage>> = null;
  try {
    image = await getComparatorBannerImage();
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    image = null;
  }

  // Sin foto no hay banner: el bloque vive de la imagen a sangre, y un fondo
  // negro vacío con texto encima no es esta sección, es otra.
  if (!image) return null;

  return (
    <section className="bg-base">
      <PromoBanner
        align="right"
        image={image}
        eyebrow="Comparador"
        eyebrowIcon={
          // 16x7, la razón real 308:132 del asset — un tamaño cuadrado loguea warning.
          <Image src="/brand/rhino-dorado.svg" alt="" width={16} height={7} aria-hidden="true" />
        }
        title="¿Cuál de las dos es tuya?"
        subtitle="Enfrenta dos bicicletas, dato por dato."
        actions={[{ label: "Comparar bicicletas", href: "/comparar", variant: "primary" }]}
      />
    </section>
  );
}
