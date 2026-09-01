import type { ItemType, PublicProductAvailability } from "@bw-bikes/shared";
import { apiFetch } from "./client";

/**
 * Fetches the no-cifras stock signal for a set of products of one `itemType`
 * (`B-carrito.md` §1) and flattens it into `sku → isAvailable`, since every
 * caller (`useVariantAvailability`) only ever needs to answer "can this SKU be
 * bought right now", never the per-product grouping the endpoint returns.
 */
export async function fetchVariantAvailability(itemType: ItemType, itemIds: string[]): Promise<Map<string, boolean>> {
  const { data } = await apiFetch<{ availability: PublicProductAvailability[] }>(
    `/catalog/availability?itemType=${itemType}&itemIds=${itemIds.join(",")}`,
    undefined,
    { unauthorizedRedirectPath: null },
  );

  const bySku = new Map<string, boolean>();
  for (const product of data.availability) {
    for (const variant of product.variants) {
      bySku.set(variant.sku, variant.isAvailable);
    }
  }
  return bySku;
}
