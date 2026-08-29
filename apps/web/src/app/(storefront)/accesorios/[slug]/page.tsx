import type { PublicCatalogFilterOptions, PublicCategory, PublicCategoryTreeNode } from "@bw-bikes/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogActiveFilters } from "@/components/storefront/catalog/CatalogActiveFilters";
import { CatalogFilterDrawer } from "@/components/storefront/catalog/CatalogFilterDrawer";
import { CatalogFilterSidebar } from "@/components/storefront/catalog/CatalogFilterSidebar";
import { CatalogHeader } from "@/components/storefront/catalog/CatalogHeader";
import { CatalogProductSection } from "@/components/storefront/catalog/CatalogProductSection";
import { CatalogSortMenu } from "@/components/storefront/catalog/CatalogSortMenu";
import { ApiError } from "@/lib/api/error";
import {
  findCategoryInTree,
  getPublicAccessoryCategoryTree,
  getPublicCatalogFilterOptions,
} from "@/lib/api/public-catalog";
import { EMPTY_CATALOG_FILTER_OPTIONS } from "@/lib/storefront-catalog";
import { parseFilterStateFromSearchParams, type NextSearchParams } from "@/lib/storefront-catalog-filters";

interface AccesorioCategoriaPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<NextSearchParams>;
}

/**
 * Reads the same 300s-cached tree `CatalogHeader` also reads — not a second
 * network round trip, Next's request memoization dedupes identical `fetch`
 * calls within one render pass. Needed here because `generateMetadata` and
 * the page component don't share props beyond `params`. Returns the whole
 * node, not just the name: `CatalogProductSection` needs the `id` to filter
 * the product list by category.
 */
async function findCategoryNode(slug: string): Promise<PublicCategoryTreeNode | PublicCategory | undefined> {
  try {
    const tree = await getPublicAccessoryCategoryTree();
    return findCategoryInTree(tree, slug);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return undefined;
  }
}

/** Same degrade contract as the catalog index: an unreachable filter-options read just empties every sidebar group instead of failing the page. */
async function loadFilterData(): Promise<{
  categoryTree: PublicCategoryTreeNode[];
  options: PublicCatalogFilterOptions;
}> {
  const [categoryTree, options] = await Promise.all([
    getPublicAccessoryCategoryTree().catch((error: unknown) => {
      if (!(error instanceof ApiError)) throw error;
      return [];
    }),
    getPublicCatalogFilterOptions("accessory").catch((error: unknown) => {
      if (!(error instanceof ApiError)) throw error;
      return EMPTY_CATALOG_FILTER_OPTIONS;
    }),
  ]);
  return { categoryTree, options };
}

export async function generateMetadata({ params }: AccesorioCategoriaPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await findCategoryNode(slug);
  if (!category) return { title: "Accesorios" };
  return {
    title: `Accesorios ${category.name}`,
    description: `Accesorios ${category.name} de Black and White Bikes.`,
  };
}

export default async function AccesorioCategoriaPage({ params, searchParams }: AccesorioCategoriaPageProps) {
  const [{ slug }, rawSearchParams] = await Promise.all([params, searchParams]);
  const category = await findCategoryNode(slug);
  if (!category) notFound();

  const filters = parseFilterStateFromSearchParams(rawSearchParams);
  const pageParam = rawSearchParams["page"];
  const page = Number(Array.isArray(pageParam) ? pageParam[0] : pageParam) || 1;

  const { categoryTree, options } = await loadFilterData();

  return (
    <>
      <CatalogHeader catalog="accessory" activeSlug={slug} />
      <div className="bg-blanco lg:grid lg:grid-cols-[clamp(10rem,11vw,11rem)_1fr] lg:gap-md lg:pl-[clamp(1rem,4vw,4rem)] lg:pr-[clamp(1rem,4vw,4rem)]">
        {/* The route already fixes the category — the sidebar's own
            Categoría group would just be a second, unpreselected way to pick
            what's already decided. "Grupo" still shows via `fixedCategoryId`
            (2026-08-28) so a shopper can narrow to one of *this* category's
            own subcategories. */}
        <CatalogFilterDrawer categoryTree={categoryTree} options={options} hideCategoryFilter fixedCategoryId={category.id} />
        <CatalogFilterSidebar categoryTree={categoryTree} options={options} hideCategoryFilter fixedCategoryId={category.id} />
        <div className="px-lg pt-md sm:px-[clamp(2rem,8vw,8rem)] lg:px-0 lg:pt-0">
          <div className="flex justify-start pb-md">
            <CatalogSortMenu />
          </div>
          <CatalogActiveFilters categoryTree={categoryTree} options={options} />
          <CatalogProductSection
            catalog="accessory"
            categoryId={category.id}
            filters={filters}
            page={page}
            basePath={`/accesorios/${slug}`}
            emptyMessage="No hay accesorios disponibles en esta categoría todavía."
            noGutter
          />
        </div>
      </div>
    </>
  );
}
