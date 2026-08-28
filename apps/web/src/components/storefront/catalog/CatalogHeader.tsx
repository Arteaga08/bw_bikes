import type { PublicCategoryTreeNode } from "@bw-bikes/shared";
import { notFound } from "next/navigation";
import {
  findCategoryInTree,
  getPublicAccessoryCategoryTree,
  getPublicBikeCategoryTree,
} from "@/lib/api/public-catalog";
import { ApiError } from "@/lib/api/error";
import { CATALOG_EYEBROW, getCatalogCopy, type CatalogKind } from "@/lib/storefront-catalog";
import { CatalogHero } from "./CatalogHero";
import { CatalogCategoryRail } from "./CatalogCategoryRail";

export interface CatalogHeaderProps {
  catalog: CatalogKind;
  /** Present on a `/[slug]` page; absent on the catalog's own index. */
  activeSlug?: string;
}

const TREE_FETCHERS: Record<CatalogKind, () => Promise<PublicCategoryTreeNode[]>> = {
  bike: getPublicBikeCategoryTree,
  accessory: getPublicAccessoryCategoryTree,
};

/**
 * Cover + category rail for a catalog page — shared by `/bicicletas`,
 * `/bicicletas/[slug]`, `/accesorios` and `/accesorios/[slug]`. One fetch: the
 * active category (if any) is resolved by searching the same tree the rail
 * renders from, rather than a second request to `/:kind-categories/:slug` —
 * the tree is already ISR-cached for 300s and shared with the nav.
 *
 * Same degrade contract as `HomeCategories`/`CompararPage`: an unreachable
 * catalog swallows into `[]` and the index page still shows its hardcoded
 * cover, just without a category rail under it. An `activeSlug` that isn't in
 * the tree is a different case — that's a shopper on a bad URL, not a
 * degraded catalog, so it 404s instead of silently falling back to the index
 * cover.
 */
export async function CatalogHeader({ catalog, activeSlug }: CatalogHeaderProps) {
  const copy = getCatalogCopy(catalog);

  let tree: PublicCategoryTreeNode[] = [];
  try {
    tree = await TREE_FETCHERS[catalog]();
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    tree = [];
  }

  const activeCategory = activeSlug ? findCategoryInTree(tree, activeSlug) : undefined;
  if (activeSlug && !activeCategory) notFound();

  const categoriesWithImage = tree.filter((category) => category.image);

  const cover = activeCategory?.image ? { url: activeCategory.image.url, alt: activeCategory.image.alt } : copy.cover;
  const eyebrow = activeCategory ? copy.label : CATALOG_EYEBROW;
  const title = activeCategory?.name ?? copy.label;

  return (
    <>
      <CatalogHero image={cover} eyebrow={eyebrow} title={title} />
      {categoriesWithImage.length > 0 ? (
        <div className="bg-blanco py-xl">
          <CatalogCategoryRail catalog={catalog} categories={categoriesWithImage} activeSlug={activeSlug} />
        </div>
      ) : null}
    </>
  );
}
