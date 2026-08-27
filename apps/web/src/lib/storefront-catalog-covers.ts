export type CatalogKind = "bike" | "accessory";

export interface CatalogCover {
  url: string;
  alt: string;
}

/**
 * Fixed placeholders, same pattern as the `*_MENU_PHOTO` constants in
 * `storefront-mega-menu.ts`: no admin management, no fetch, swapped by hand.
 * TODO(marca): reemplazar por fotos reales de marca.
 */
const BIKE_COVER: CatalogCover = {
  url: "https://res.cloudinary.com/m55soucl/image/upload/v1787779740/HP_A50_D.webp",
  alt: "Bicicleta Black and White Bikes en estudio",
};

const ACCESSORY_COVER: CatalogCover = {
  url: "https://res.cloudinary.com/m55soucl/image/upload/v1787779748/Banner_HP_D_OGAT.webp",
  alt: "Accesorios Black and White Bikes en exhibición",
};

const OFFERS_COVER: CatalogCover = {
  url: "https://res.cloudinary.com/m55soucl/image/upload/v1787779740/HP_A50_D.webp",
  alt: "Bicicletas Black and White Bikes en rebaja",
};

const CATALOG_COVERS: Record<CatalogKind, CatalogCover> = {
  bike: BIKE_COVER,
  accessory: ACCESSORY_COVER,
};

/**
 * The cover for a catalog's index page, and the fallback for a category whose
 * own photo was removed from the admin: a category page must never render a
 * bare dark band where the cover belongs.
 */
function getCatalogCover(catalog: CatalogKind): CatalogCover {
  return CATALOG_COVERS[catalog];
}

export { getCatalogCover, OFFERS_COVER };
