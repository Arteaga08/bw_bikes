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

/** How many tiles the home's "Novedades" rail shows — Manuel's call. */
const HOME_NEW_PRODUCTS_LIMIT = 10;

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
 * Server-side only, anonymous storefront read for the home's "Novedades"
 * rail (M12, entrega 5/10): the `HOME_NEW_PRODUCTS_LIMIT` most recently
 * flagged products across *both* catalogs, bikes and accessories mixed.
 *
 * `isNewArrival` is the admin's curation flag (`Bike.isNewArrival` /
 * `Accessory.isNewArrival`) — a public list already filters to
 * `isActive: true` server-side (`PUBLIC_VISIBILITY` in `product.service.ts`),
 * so this never surfaces an archived product. The two catalogs are fetched
 * in parallel, each already sorted `-createdAt` and capped to the same
 * limit (no single catalog can need more than the whole rail), then merged
 * and re-sorted client-side — two independently-paginated lists can't be
 * merged any other way.
 */
export async function getPublicNewProducts(): Promise<PublicProductSummary[]> {
  const query = `?isNewArrival=true&sort=-createdAt&limit=${HOME_NEW_PRODUCTS_LIMIT}`;
  const [bikesRes, accessoriesRes] = await Promise.all([
    publicApiFetch<{ bikes: PublicBike[] }>(`/catalog/bikes${query}`, { revalidateSeconds: 300 }),
    publicApiFetch<{ accessories: PublicAccessory[] }>(`/catalog/accessories${query}`, { revalidateSeconds: 300 }),
  ]);

  const merged = [
    ...bikesRes.data.bikes.map((bike) => toSummary(bike, "bike")),
    ...accessoriesRes.data.accessories.map((accessory) => toSummary(accessory, "accessory")),
  ];

  return merged
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, HOME_NEW_PRODUCTS_LIMIT);
}
