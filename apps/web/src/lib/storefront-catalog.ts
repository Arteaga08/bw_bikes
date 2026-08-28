import type { PublicCatalogFilterOptions } from "@bw-bikes/shared";

export type CatalogKind = "bike" | "accessory";

export interface CatalogCover {
  url: string;
  alt: string;
}

export interface CatalogCopy {
  /** Route prefix for this catalog's category pages. */
  basePath: string;
  /** The catalog's own name, in Spanish. Titles the index page. */
  label: string;
  cover: CatalogCover;
}

/**
 * Covers are fixed placeholders, same pattern as the `*_MENU_PHOTO` constants
 * in `storefront-mega-menu.ts`: no admin management, no fetch, swapped by hand.
 * TODO(marca): reemplazar por fotos reales de marca.
 *
 * Deliberately free of any import from `lib/api` so a client component can
 * read `CatalogKind` and this copy without dragging the server fetch layer
 * into its bundle.
 */
const CATALOG_COPY: Record<CatalogKind, CatalogCopy> = {
  bike: {
    basePath: "/bicicletas",
    label: "Bicicletas",
    cover: {
      url: "https://res.cloudinary.com/m55soucl/image/upload/v1787779740/HP_A50_D.webp",
      alt: "Bicicleta Black and White Bikes en estudio",
    },
  },
  accessory: {
    basePath: "/accesorios",
    label: "Accesorios",
    cover: {
      url: "https://res.cloudinary.com/m55soucl/image/upload/v1787779748/Banner_HP_D_OGAT.webp",
      alt: "Accesorios Black and White Bikes en exhibición",
    },
  },
};

/** Ofertas has no category tree of its own, so it carries copy but no `basePath`. */
const OFFERS_COVER: CatalogCover = {
  url: "https://res.cloudinary.com/m55soucl/image/upload/v1787779740/HP_A50_D.webp",
  alt: "Bicicletas Black and White Bikes en rebaja",
};

/** The kicker above every catalog cover's title. */
const CATALOG_EYEBROW = "Catálogo";

function getCatalogCopy(catalog: CatalogKind): CatalogCopy {
  return CATALOG_COPY[catalog];
}

/** The filter sidebar's fallback when `getPublicCatalogFilterOptions` fails — every group degrades to absence (`CatalogFilterGroups` renders nothing for an empty list), same contract as an unreachable category tree. */
const EMPTY_CATALOG_FILTER_OPTIONS: PublicCatalogFilterOptions = {
  brands: [],
  sizes: [],
  colors: [],
  price: null,
  specs: [],
};

export { getCatalogCopy, OFFERS_COVER, CATALOG_EYEBROW, EMPTY_CATALOG_FILTER_OPTIONS };
