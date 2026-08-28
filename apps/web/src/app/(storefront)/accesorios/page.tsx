import type { PublicCatalogFilterOptions, PublicCategoryTreeNode } from "@bw-bikes/shared";
import type { Metadata } from "next";
import { CatalogActiveFilters } from "@/components/storefront/catalog/CatalogActiveFilters";
import { CatalogFilterDrawer } from "@/components/storefront/catalog/CatalogFilterDrawer";
import { CatalogFilterSidebar } from "@/components/storefront/catalog/CatalogFilterSidebar";
import { CatalogHeader } from "@/components/storefront/catalog/CatalogHeader";
import { CatalogProductSection } from "@/components/storefront/catalog/CatalogProductSection";
import { ApiError } from "@/lib/api/error";
import { getPublicAccessoryCategoryTree, getPublicCatalogFilterOptions } from "@/lib/api/public-catalog";
import { EMPTY_CATALOG_FILTER_OPTIONS } from "@/lib/storefront-catalog";
import { parseFilterStateFromSearchParams, type NextSearchParams } from "@/lib/storefront-catalog-filters";

export const metadata: Metadata = {
  title: "Accesorios",
  description: "Explora el catálogo completo de accesorios Black and White Bikes por categoría.",
};

interface AccesoriosPageProps {
  searchParams: Promise<NextSearchParams>;
}

/**
 * Category tree and filter vocabulary in parallel — two independent reads,
 * same degrade contract as `CatalogHeader`/`CatalogProductSection`: only
 * `ApiError` is swallowed, and the page still renders (without a sidebar
 * group that has nothing to offer) rather than 500ing over a filter fetch.
 */
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

/**
 * Catalog index (paso 3/3, filtros incluidos): cover + category rail
 * (`CatalogHeader`), barra de filtros (`CatalogFilterSidebar`/
 * `CatalogFilterDrawer`) y grilla de producto con paginador
 * (`CatalogProductSection`). Dynamic — `searchParams` drives both the
 * filters and the page number, so this can no longer be statically
 * generated; the tree, the filter vocabulary and the product list itself
 * all still carry their own 300s ISR cache underneath.
 */
export default async function AccesoriosPage({ searchParams }: AccesoriosPageProps) {
  const rawSearchParams = await searchParams;
  const filters = parseFilterStateFromSearchParams(rawSearchParams);
  const pageParam = rawSearchParams["page"];
  const page = Number(Array.isArray(pageParam) ? pageParam[0] : pageParam) || 1;

  const { categoryTree, options } = await loadFilterData();

  return (
    <>
      <CatalogHeader catalog="accessory" />
      <div className="bg-blanco lg:grid lg:grid-cols-[clamp(10rem,11vw,11rem)_1fr] lg:gap-md lg:pl-[clamp(1rem,4vw,4rem)] lg:pr-[clamp(1rem,4vw,4rem)]">
        <CatalogFilterSidebar categoryTree={categoryTree} options={options} />
        <div className="px-lg sm:px-[clamp(2rem,8vw,8rem)] lg:px-0">
          <div className="flex items-center pt-lg lg:hidden">
            <CatalogFilterDrawer categoryTree={categoryTree} options={options} />
          </div>
          <CatalogActiveFilters categoryTree={categoryTree} options={options} />
          <CatalogProductSection
            catalog="accessory"
            filters={filters}
            page={page}
            basePath="/accesorios"
            emptyMessage="No hay accesorios disponibles por el momento."
            noGutter
          />
        </div>
      </div>
    </>
  );
}
