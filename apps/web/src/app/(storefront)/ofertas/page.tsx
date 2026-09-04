import type { PublicCatalogFilterOptions, PublicCategoryTreeNode } from "@bw-bikes/shared";
import type { Metadata } from "next";
import { CatalogActiveFilters } from "@/components/storefront/catalog/CatalogActiveFilters";
import { CatalogFilterDrawer } from "@/components/storefront/catalog/CatalogFilterDrawer";
import { CatalogFilterSidebar } from "@/components/storefront/catalog/CatalogFilterSidebar";
import { CatalogHero } from "@/components/storefront/catalog/CatalogHero";
import { CatalogSortMenu } from "@/components/storefront/catalog/CatalogSortMenu";
import { OfertasCategoryRail } from "@/components/storefront/catalog/OfertasCategoryRail";
import { OfertasProductSection } from "@/components/storefront/catalog/OfertasProductSection";
import { HomeNewProducts } from "@/components/storefront/products/HomeNewProducts";
import { ApiError } from "@/lib/api/error";
import {
  buildColorSwatchIndex,
  getPublicAccessoryCategoryTree,
  getPublicBikeCategoryTree,
  getPublicCatalogFilterOptions,
} from "@/lib/api/public-catalog";
import { mergeCatalogFilterOptions } from "@/lib/catalog/merge-filter-options";
import { CATALOG_EYEBROW, EMPTY_CATALOG_FILTER_OPTIONS, OFFERS_COVER } from "@/lib/storefront-catalog";
import { parseFilterStateFromSearchParams, type NextSearchParams } from "@/lib/storefront-catalog-filters";

export const metadata: Metadata = {
  title: "Ofertas",
  description: "Rebajas vigentes de bicicletas y accesorios Black and White Bikes.",
};

interface OfertasPageProps {
  searchParams: Promise<NextSearchParams>;
}

/**
 * Both catalogs' category trees and filter vocabularies in parallel. The
 * trees are kept both separately (`bikeCategoryTree`/`accessoryCategoryTree`,
 * for `OfertasCategoryRail`'s bikes-then-accessories rail) and merged
 * (`categoryTree`, via `mergeCatalogFilterOptions`) into the single set
 * "Ofertas"' sidebar offers. Same degrade contract as
 * `bicicletas/page.tsx`'s `loadFilterData`: only `ApiError` is swallowed, and
 * each half degrades to empty on its own rather than losing the other
 * catalog's data too.
 */
async function loadFilterData(): Promise<{
  bikeCategoryTree: PublicCategoryTreeNode[];
  accessoryCategoryTree: PublicCategoryTreeNode[];
  categoryTree: PublicCategoryTreeNode[];
  options: PublicCatalogFilterOptions;
}> {
  const [bikeCategoryTree, accessoryCategoryTree, bikeOptions, accessoryOptions] = await Promise.all([
    getPublicBikeCategoryTree().catch((error: unknown) => {
      if (!(error instanceof ApiError)) throw error;
      return [];
    }),
    getPublicAccessoryCategoryTree().catch((error: unknown) => {
      if (!(error instanceof ApiError)) throw error;
      return [];
    }),
    getPublicCatalogFilterOptions("bike").catch((error: unknown) => {
      if (!(error instanceof ApiError)) throw error;
      return EMPTY_CATALOG_FILTER_OPTIONS;
    }),
    getPublicCatalogFilterOptions("accessory").catch((error: unknown) => {
      if (!(error instanceof ApiError)) throw error;
      return EMPTY_CATALOG_FILTER_OPTIONS;
    }),
  ]);

  return {
    bikeCategoryTree,
    accessoryCategoryTree,
    categoryTree: [...bikeCategoryTree, ...accessoryCategoryTree],
    options: mergeCatalogFilterOptions(bikeOptions, accessoryOptions),
  };
}

/**
 * Rebajas: cover (`CatalogHero`), a combined category rail
 * (`OfertasCategoryRail` — bike categories then accessory categories, each
 * linking into its own catalog; "Ofertas" has no `/[slug]` subpages of its
 * own to route a rail tile to), full filter sidebar and a single grid mixing
 * bikes and accessories, then `HomeNewProducts`' "Novedades" rail — same
 * visual language as `/bicicletas`/`/accesorios`. Dynamic for the same reason
 * those two are: `searchParams` drives filters and page number.
 */
export default async function OfertasPage({ searchParams }: OfertasPageProps) {
  const rawSearchParams = await searchParams;
  const filters = parseFilterStateFromSearchParams(rawSearchParams);
  const pageParam = rawSearchParams["page"];
  const page = Number(Array.isArray(pageParam) ? pageParam[0] : pageParam) || 1;

  const { bikeCategoryTree, accessoryCategoryTree, categoryTree, options } = await loadFilterData();
  const colorSwatchIndex = buildColorSwatchIndex(options.colors);

  const bikeCategoriesWithImage = bikeCategoryTree.filter((category) => category.image);
  const accessoryCategoriesWithImage = accessoryCategoryTree.filter((category) => category.image);
  const hasCategoryRail = bikeCategoriesWithImage.length > 0 || accessoryCategoriesWithImage.length > 0;

  return (
    <>
      <CatalogHero image={OFFERS_COVER} eyebrow={CATALOG_EYEBROW} title="Ofertas" />
      {hasCategoryRail ? (
        <div className="bg-blanco py-xl">
          <OfertasCategoryRail bikeCategories={bikeCategoriesWithImage} accessoryCategories={accessoryCategoriesWithImage} />
        </div>
      ) : null}
      <div className="bg-blanco lg:grid lg:grid-cols-[clamp(10rem,11vw,11rem)_1fr] lg:gap-md lg:pl-[clamp(1rem,4vw,4rem)] lg:pr-[clamp(1rem,4vw,4rem)]">
        <CatalogFilterDrawer categoryTree={categoryTree} options={options} />
        <CatalogFilterSidebar categoryTree={categoryTree} options={options} />
        <div className="px-lg pt-md sm:px-[clamp(2rem,8vw,8rem)] lg:px-0 lg:pt-0">
          <div className="flex justify-start pb-md">
            <CatalogSortMenu />
          </div>
          <CatalogActiveFilters categoryTree={categoryTree} options={options} />
          <OfertasProductSection
            filters={filters}
            page={page}
            colorSwatchIndex={colorSwatchIndex}
            emptyMessage="No hay productos en oferta por el momento."
          />
        </div>
      </div>
      <HomeNewProducts />
    </>
  );
}
