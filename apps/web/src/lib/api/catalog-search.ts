import type { PublicAccessory, PublicBike } from "@bw-bikes/shared";
import { apiFetch } from "./client";
import { toSummary, type PublicProductSummary } from "./public-catalog";

/** Rows per catalog shown in the navbar's search dropdown — Manuel's call. */
export const SEARCH_RESULT_LIMIT = 5;

export interface CatalogSearchResults {
  bikes: PublicProductSummary[];
  accessories: PublicProductSummary[];
}

/**
 * Browser-side counterpart to `public-catalog.ts`'s server-only reads: the
 * navbar search box fetches on every keystroke (debounced), which only works
 * through `apiFetch` (same-origin, rewritten by `next.config.ts`) — the
 * `publicApiFetch` used everywhere else in `public-catalog.ts` resolves
 * `apiInternalUrl()` from a server-only env var and would throw in the
 * browser. `unauthorizedRedirectPath: null` matches `catalog-availability.ts`:
 * an anonymous shopper must never get bounced to `/admin/login` over a public
 * catalog read.
 *
 * Mirrors `/catalog/{bikes,accessories}?search=` — already matching product
 * name, variant SKU and brand name server-side (`product.service.ts`), so no
 * extra client-side filtering is needed here.
 */
export async function searchCatalog(term: string): Promise<CatalogSearchResults> {
  const query = `search=${encodeURIComponent(term)}&limit=${SEARCH_RESULT_LIMIT}`;

  const [bikes, accessories] = await Promise.all([
    apiFetch<{ bikes: PublicBike[] }>(`/catalog/bikes?${query}`, undefined, {
      unauthorizedRedirectPath: null,
    }).then((res) => res.data.bikes.map((bike) => toSummary(bike, "bike"))),
    apiFetch<{ accessories: PublicAccessory[] }>(`/catalog/accessories?${query}`, undefined, {
      unauthorizedRedirectPath: null,
    }).then((res) => res.data.accessories.map((accessory) => toSummary(accessory, "accessory"))),
  ]);

  return { bikes, accessories };
}
