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
