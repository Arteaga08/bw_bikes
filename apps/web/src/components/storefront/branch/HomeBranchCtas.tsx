import { BRANCH_MAPS_URL, WHATSAPP_ADVISORY_URL } from "@/lib/brand-social";
import { HomeBranchCtaCarousel } from "./HomeBranchCtaCarousel";

export interface BranchCtaTileData {
  key: "branch" | "advisory";
  label: string;
  image: { url: string; alt: string };
  href: string;
}

/**
 * The home's "sucursal" section (M12) — closes the sequence documented in
 * `docs/MILESTONES.md` (`… → descubre tu bici → sucursal → footer`). Same
 * two-tile photo-CTA grammar as `HomeCategoryCtas`, but both destinations are
 * external (Google Maps, WhatsApp), so unlike that section this one has no
 * admin-managed photos and no fetch/degrade step: the tiles are a fixed,
 * two-entry list.
 *
 * TODO(marca): reemplazar las URLs de Cloudinary por las fotos reales.
 */
const BRANCH_TILES: BranchCtaTileData[] = [
  {
    key: "branch",
    label: "Visítanos",
    image: {
      url: "https://res.cloudinary.com/m55soucl/image/upload/v1787779740/HP_A50_D.webp",
      alt: "Fachada de la sucursal Black and White Bikes",
    },
    href: BRANCH_MAPS_URL,
  },
  {
    key: "advisory",
    label: "Te asesoramos",
    image: {
      url: "https://res.cloudinary.com/m55soucl/image/upload/v1787779748/Banner_HP_D_OGAT.webp",
      alt: "Asesor de Black and White Bikes ayudando a un cliente",
    },
    href: WHATSAPP_ADVISORY_URL,
  },
];

export function HomeBranchCtas() {
  return (
    <section className="bg-blanco py-3xl">
      <HomeBranchCtaCarousel tiles={BRANCH_TILES} />
    </section>
  );
}
