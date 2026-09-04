import type { PublicBrand, PublicCategoryTreeNode } from "@bw-bikes/shared";

export interface MegaMenuLinkItem {
  id: string;
  name: string;
  href: string;
}

export interface MegaMenuSection {
  /** Omitted for the single-section case (Accesorios) — nothing to label. */
  title?: string;
  items: MegaMenuLinkItem[];
}

export interface MegaMenuPhoto {
  url: string;
  alt: string;
  rhinoCorner?: "left" | "right";
}

export interface MegaMenuContent {
  /** `[]` for Ofertas — no category tree, just the CTA row below. */
  sections: MegaMenuSection[];
  /** Kicker shown above `ctaLabel` when `sections` is empty — Ofertas' own "Comprar por categoría"-style header. */
  eyebrow?: string;
  ctaLabel: string;
  ctaHref: string;
  photo: MegaMenuPhoto;
}

/**
 * The one place that decides where a mega-menu link points. Both surfaces —
 * the desktop panel (`NavMegaMenuPanel`) and the mobile drawer's accordion
 * (`NavAccordionItem`) — render off this same `MegaMenuContent`, so neither
 * can drift from the other on what it shows or where a link goes.
 *
 * Photos are fixed placeholders, same pattern as `HomeBranchCtas`: no admin
 * management, no fetch, swapped by hand when real brand photography exists.
 * TODO(marca): reemplazar por fotos reales de marca.
 */
const BIKE_MENU_PHOTO: MegaMenuPhoto = {
  url: "https://res.cloudinary.com/m55soucl/image/upload/v1787779740/HP_A50_D.webp",
  alt: "Bicicleta Black and White Bikes en estudio",
  rhinoCorner: "left",
};

const ACCESSORY_MENU_PHOTO: MegaMenuPhoto = {
  url: "https://res.cloudinary.com/m55soucl/image/upload/v1787779748/Banner_HP_D_OGAT.webp",
  alt: "Accesorios Black and White Bikes en exhibición",
  rhinoCorner: "left",
};

const OFFERS_MENU_PHOTO: MegaMenuPhoto = {
  url: "https://res.cloudinary.com/m55soucl/image/upload/v1787779740/HP_A50_D.webp",
  alt: "Bicicletas Black and White Bikes en rebaja",
  rhinoCorner: "left",
};

/**
 * Bicicletas → dos secciones: categorías (`/bicicletas/:slug`, mismo shape
 * que `NavAccordionSubLink` ya resolvía) y marcas. El filtro por marca apunta
 * a `?brand=<slug>` porque `flatCatalogListQuerySchema`
 * (`apps/api/src/validators/list-query.validator.ts`) ya acepta ese query
 * param — la página `/bicicletas` en sí no existe todavía (mismo
 * 404-hasta-que-se-construya que documenta `storefront-nav.ts`), pero el
 * shape de la URL no es inventado.
 *
 * `CATEGORY_SECTION_TITLE` es compartido con Accesorios (mismo título de
 * sección en ambos paneles) — solo Bicicletas tiene además una sección de marca.
 */
export const CATEGORY_SECTION_TITLE = "Comprar por categoría";
const BRAND_SECTION_TITLE = "Comprar por marca";

export function buildBikeMegaMenuContent(
  categories: PublicCategoryTreeNode[],
  brands: PublicBrand[],
): MegaMenuContent {
  return {
    sections: [
      {
        title: CATEGORY_SECTION_TITLE,
        items: categories.map((category) => ({
          id: category.id,
          name: category.name,
          href: `/bicicletas/${category.slug}`,
        })),
      },
      {
        title: BRAND_SECTION_TITLE,
        items: brands.map((brand) => ({
          id: brand.id,
          name: brand.name,
          href: `/bicicletas?brand=${brand.slug}`,
        })),
      },
    ],
    ctaLabel: "Ver todas",
    ctaHref: "/bicicletas",
    photo: BIKE_MENU_PHOTO,
  };
}

/**
 * Accesorios → una sola sección de categorías, `/accesorios/:slug`. Mismo
 * título de sección que Bicicletas ("Comprar por categoría") por consistencia
 * visual entre los dos paneles con categorías reales.
 */
export function buildAccessoryMegaMenuContent(categories: PublicCategoryTreeNode[]): MegaMenuContent {
  return {
    sections: [
      {
        title: CATEGORY_SECTION_TITLE,
        items: categories.map((category) => ({
          id: category.id,
          name: category.name,
          href: `/accesorios/${category.slug}`,
        })),
      },
    ],
    ctaLabel: "Ver todas",
    ctaHref: "/accesorios",
    photo: ACCESSORY_MENU_PHOTO,
  };
}

/**
 * Ofertas → sin secciones, sin fetch. `/ofertas` mezcla bicicletas y
 * accesorios en una sola grilla (`ofertas/page.tsx`) y no tiene páginas
 * `/ofertas/:slug` propias — a diferencia de Bicicletas/Accesorios, no hay un
 * árbol de categorías al que un link de sección pueda apuntar, así que este
 * panel se queda en un único CTA.
 */
export function buildOffersMegaMenuContent(): MegaMenuContent {
  return {
    sections: [],
    eyebrow: "Ofertas",
    ctaLabel: "Rebajas de bicis y accesorios",
    ctaHref: "/ofertas",
    photo: OFFERS_MENU_PHOTO,
  };
}
