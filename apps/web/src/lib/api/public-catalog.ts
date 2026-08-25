import type { PublicCategoryTreeNode } from "@bw-bikes/shared";
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
  const res = await publicApiFetch<{ tree: PublicCategoryTreeNode[] }>("/bike-categories/tree", {
    revalidateSeconds: 300,
  });
  return res.data.tree;
}
