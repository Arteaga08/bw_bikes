import type {
  PriceCents,
  ProductImage,
  PublicAccessory,
  PublicBike,
  PublicBrand,
  PublicCategoryTreeNode,
} from "@bw-bikes/shared";
import { publicApiFetch } from "./public";

/**
 * Server-side only, anonymous storefront reads of the public category tree
 * — the counterpart to `adminBikeCategoriesApi`/`adminAccessoryCategoriesApi`
 * in `admin-catalog.ts`, but hitting the unauthenticated `/tree` routes via
 * `publicApiFetch` instead of the cookie-forwarding admin client.
 *
 * Category trees change about as often as the catalog itself does, not on
 * every request — `revalidateSeconds` defaults to 5 minutes here (vs.
 * `publicApiFetch`'s own 300s default, spelled out because a stale nav
 * accordion is more visible to a shopper than a stale hero slide).
 */
export async function getPublicBikeCategoryTree(): Promise<PublicCategoryTreeNode[]> {
  // `/catalog` prefix required — `bike-categories/tree` is mounted under
  // `/api/v1/catalog` (`apps/api/src/routes/index.ts`), not at the API root.
  // Fixed 2026-08-25: the bare path 404'd silently because `ApiError` here is
  // always caught by the caller (`(storefront)/layout.tsx`, `HomeCategories`),
  // so the nav accordion was rendering empty with no visible error.
  const res = await publicApiFetch<{ tree: PublicCategoryTreeNode[] }>("/catalog/bike-categories/tree", {
    revalidateSeconds: 300,
  });
  return res.data.tree;
}

/**
 * Server-side only, anonymous storefront read de las marcas activas — mismo
 * seam que `getPublicBikeCategoryTree`, contra `/catalog/brands`
 * (`listPublicBrands` en `apps/api/src/controllers/brand.controller.ts`, ya
 * filtra `isActive: true` y ordena `{ order, name }` en el servidor).
 * `limit=100` (el máximo que acepta `list-query.ts`) porque el default del
 * endpoint es 20 — el home marquee (M12) necesita el catálogo completo de
 * marcas activas, no una sola página.
 */
export async function getPublicBrands(): Promise<PublicBrand[]> {
  const res = await publicApiFetch<{ brands: PublicBrand[] }>("/catalog/brands?limit=100", {
    revalidateSeconds: 300,
  });
  return res.data.brands;
}

/** How many tiles each of the home's product rails shows — Manuel's call. */
const HOME_PRODUCT_RAIL_LIMIT = 10;

/**
 * The shape `ProductCard` (storefront) actually consumes — a slimmed-down
 * projection of `PublicBike`/`PublicAccessory` shared across both catalogs,
 * plus `kind` (which catalog it came from, needed to build its href once the
 * PDP exists — see `product-href.ts`). Declared here, not in
 * `packages/shared`: it's a view shape for this one rail, not part of the API
 * contract.
 */
export interface PublicProductSummary {
  id: string;
  slug: string;
  kind: "bike" | "accessory";
  name: string;
  brand: PublicBrand;
  price: PriceCents;
  gallery: ProductImage[];
  createdAt: string;
}

function toSummary(product: PublicBike | PublicAccessory, kind: "bike" | "accessory"): PublicProductSummary {
  return {
    id: product.id,
    slug: product.slug,
    kind,
    name: product.name,
    brand: product.brand,
    price: product.price,
    gallery: product.gallery,
    createdAt: product.createdAt,
  };
}

/**
 * Shared engine behind the home's curated product rails. `flag` is the admin
 * curation field to filter by (`isNewArrival` for "Novedades" and for
 * "Accesorios más vendidos", `isCustomerFavorite` for "Favoritas de los
 * ciclistas") — a public list already filters to `isActive: true`
 * server-side (`PUBLIC_VISIBILITY` in `product.service.ts`), so no rail can
 * surface an archived product.
 *
 * `scope` picks which catalog(s) to read: `"both"` (default) fetches bikes
 * and accessories in parallel, sorted `-createdAt` and capped to the same
 * limit, then merges and re-sorts here — two independently-paginated lists
 * can't be merged any other way. `"bike"`/`"accessory"` skip the other
 * catalog's request entirely rather than fetching and discarding it.
 */
async function fetchCuratedProductRail(
  flag: "isNewArrival" | "isCustomerFavorite",
  scope: "both" | "bike" | "accessory" = "both",
): Promise<PublicProductSummary[]> {
  const query = `?${flag}=true&sort=-createdAt&limit=${HOME_PRODUCT_RAIL_LIMIT}`;

  const [bikes, accessories] = await Promise.all([
    scope === "accessory"
      ? []
      : publicApiFetch<{ bikes: PublicBike[] }>(`/catalog/bikes${query}`, { revalidateSeconds: 300 }).then((res) =>
          res.data.bikes.map((bike) => toSummary(bike, "bike")),
        ),
    scope === "bike"
      ? []
      : publicApiFetch<{ accessories: PublicAccessory[] }>(`/catalog/accessories${query}`, {
          revalidateSeconds: 300,
        }).then((res) => res.data.accessories.map((accessory) => toSummary(accessory, "accessory"))),
  ]);

  return [...bikes, ...accessories]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, HOME_PRODUCT_RAIL_LIMIT);
}

/**
 * Server-side only, anonymous storefront read for the home's "Novedades"
 * rail (M12, entrega 5/10): the most recently flagged bikes. Scoped to bikes
 * only since the home's accessories separation — accessories flagged
 * `isNewArrival` now surface only in "Accesorios más vendidos"
 * (`getPublicBestSellingAccessories`), not mixed in here.
 */
export async function getPublicNewProducts(): Promise<PublicProductSummary[]> {
  return fetchCuratedProductRail("isNewArrival", "bike");
}

/**
 * Same read for the home's "Favoritas de los ciclistas" rail (M12, entrega
 * 8/10), against `isCustomerFavorite`. A separate function rather than an
 * exported `flag` parameter so each section names what it wants and the
 * query string stays out of the component layer.
 */
export async function getPublicFavoriteProducts(): Promise<PublicProductSummary[]> {
  return fetchCuratedProductRail("isCustomerFavorite");
}

/**
 * Server-side only, anonymous storefront read for the home's "Accesorios más
 * vendidos" rail. Reuses `Accessory`'s existing `isNewArrival` flag rather
 * than adding a new field — Manuel's call, same reasoning as "Novedades"
 * (which was called "bestseller" in M12's original plan and got renamed
 * without touching the underlying data, see `docs/MILESTONES.md` entrega
 * 5/10): the home's heading is a merchandising label, decoupled from the
 * field name that drives it. Scoped to accessories only — bikes flagged
 * `isNewArrival` still belong to "Novedades" (`getPublicNewProducts`).
 */
export async function getPublicBestSellingAccessories(): Promise<PublicProductSummary[]> {
  return fetchCuratedProductRail("isNewArrival", "accessory");
}

/**
 * How many spec groups ("apartados") the comparator shows per bike. The full
 * sheet can run to a dozen groups; three is what fits before the comparison
 * stops being scannable and turns into a spreadsheet — the PDP is where the
 * rest belongs.
 */
const COMPARATOR_GROUP_LIMIT = 3;

/**
 * A bike trimmed to exactly what the comparator renders. Declared here rather
 * than in `packages/shared` for the same reason as `PublicProductSummary`
 * above: it's a view shape for one screen, not part of the API contract.
 *
 * `specGroups` keeps only the visible groups and fields, already sorted and
 * capped — the projection is what keeps a 100-bike catalog response from
 * reaching the browser in full.
 */
export interface ComparableBike {
  id: string;
  slug: string;
  name: string;
  brandName: string;
  price: PriceCents;
  image?: { url: string; alt?: string };
  specGroups: { title: string; fields: { label: string; value: string }[] }[];
}

/** One entry in the comparator's pickers — deliberately without the spec sheet. */
export interface ComparatorOption {
  slug: string;
  name: string;
  brandName: string;
}

/** The primary image is the one with the lowest `order`, not the first stored — same rule as the API's own `primaryImagePublicId`. */
function primaryImage(bike: PublicBike): ProductImage | undefined {
  return [...bike.gallery].sort((a, b) => a.order - b.order)[0];
}

/**
 * `PublicBike` → `ComparableBike`. Drops anything the admin marked hidden:
 * `visible === false` on a group or a field means "not for the storefront",
 * and a comparator that leaked those would expose more than the PDP does.
 */
export function toComparableBike(bike: PublicBike): ComparableBike {
  const image = primaryImage(bike);

  return {
    id: bike.id,
    slug: bike.slug,
    name: bike.name,
    brandName: bike.brand.name,
    price: bike.price,
    ...(image ? { image: { url: image.url, ...(image.alt ? { alt: image.alt } : {}) } } : {}),
    specGroups: [...bike.specGroups]
      .filter((group) => group.visible)
      .sort((a, b) => a.order - b.order)
      .slice(0, COMPARATOR_GROUP_LIMIT)
      .map((group) => ({
        title: group.title,
        fields: [...group.fields]
          .filter((field) => field.visible)
          .sort((a, b) => a.order - b.order)
          .map((field) => ({ label: field.label, value: field.value })),
      }))
      // Un apartado sin campos visibles es un encabezado huérfano, no una fila vacía.
      .filter((group) => group.fields.length > 0),
  };
}

export interface ComparatorSeed {
  options: ComparatorOption[];
  initialPair: [ComparableBike, ComparableBike] | null;
}

/**
 * Everything the comparator page needs on first paint, from a **single**
 * upstream call: the picker list for every active bike plus the two bikes
 * shown before the visitor touches anything.
 *
 * `limit=100` is the maximum `list-query.ts` accepts, and the response
 * carries each bike's full `variants`/`gallery`/`specGroups`. That weight
 * stays on the server: only the light `options` list and two projected bikes
 * are serialized into the page, and every later change is fetched one bike at
 * a time through `app/api/catalog/bikes/[slug]`.
 *
 * `initialPair` is `null` when fewer than two bikes have a photo — the caller
 * renders nothing rather than a comparison with an empty column.
 */
export async function getComparatorSeed(): Promise<ComparatorSeed> {
  const res = await publicApiFetch<{ bikes: PublicBike[] }>("/catalog/bikes?sort=name&limit=100", {
    revalidateSeconds: 300,
  });
  const bikes = res.data.bikes;

  const options = bikes.map((bike) => ({
    slug: bike.slug,
    name: bike.name,
    brandName: bike.brand.name,
  }));

  // Preferencia por bicis con ficha técnica publicada: el par por defecto es lo
  // primero que ve el visitante, y dos bicis sin apartados visibles dejan la
  // tabla en su estado vacío aunque el catálogo sí tenga qué comparar. Dentro
  // de cada grupo se respeta el orden alfabético que ya trajo el API.
  const comparable = bikes
    .filter((bike) => bike.gallery.length > 0)
    .map((bike) => ({ bike, hasSheet: toComparableBike(bike).specGroups.length > 0 }))
    .sort((a, b) => Number(b.hasSheet) - Number(a.hasSheet))
    .map((entry) => entry.bike);
  const [first, second] = comparable;
  const initialPair: ComparatorSeed["initialPair"] =
    first && second ? [toComparableBike(first), toComparableBike(second)] : null;

  return { options, initialPair };
}

/**
 * A photo for the home's comparator banner. There is no admin-configured
 * image for this section (unlike `bike-of-month`), so it borrows the newest
 * bike's own studio shot — always a real, current product rather than a
 * stock asset that would go stale. `limit=4` because the newest bike may not
 * have a photo yet and the next one usually does.
 */
export async function getComparatorBannerImage(): Promise<{ url: string; alt?: string } | null> {
  const res = await publicApiFetch<{ bikes: PublicBike[] }>("/catalog/bikes?sort=-createdAt&limit=4", {
    revalidateSeconds: 300,
  });

  for (const bike of res.data.bikes) {
    const image = primaryImage(bike);
    if (image) return { url: image.url, ...(image.alt ? { alt: image.alt } : {}) };
  }
  return null;
}
