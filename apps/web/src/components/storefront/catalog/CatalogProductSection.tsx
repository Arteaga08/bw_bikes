import type { PublicColorSwatch } from "@/lib/api/public-catalog";
import { getPublicCatalogProducts } from "@/lib/api/public-catalog";
import { ApiError } from "@/lib/api/error";
import type { CatalogKind } from "@/lib/storefront-catalog";
import { serializeFilterState, type CatalogFilterState } from "@/lib/storefront-catalog-filters";
import { CatalogPagination } from "./CatalogPagination";
import { CatalogProductGrid } from "./CatalogProductGrid";

export interface CatalogProductSectionProps {
  catalog: CatalogKind;
  /** Present on a `/[slug]` category page; absent on the catalog's own index — same split `CatalogHeader.activeSlug` already draws. */
  categoryId?: string;
  /** The filter sidebar's state, parsed from this render's `searchParams` — forwarded to the API exactly as `serializeFilterState` would write it to the URL. Omitted only where a caller has no filter bar at all. */
  filters?: CatalogFilterState;
  page: number;
  /** The page's own path, with no query string — `CatalogPagination` appends `?page=`. */
  basePath: string;
  emptyMessage: string;
  /** Forwarded to `CatalogProductGrid` — set when the filter sidebar's results column already owns the page gutter. */
  noGutter?: boolean;
  /**
   * Built by the caller from the same `getPublicCatalogFilterOptions` read
   * it already runs for the filter sidebar (`loadFilterData`), same as
   * `OfertasProductSection`'s own `colorSwatchIndex` prop — this component
   * used to fetch swatches itself via a `getPublicColorSwatches` call that,
   * once that helper got its own lightweight `/colors` endpoint
   * (M-optimización), stopped being the same request as the sidebar's and
   * became a second, needless one on every catalog page.
   */
  colorSwatchIndex: Map<string, PublicColorSwatch>;
}

/**
 * The listing half of a catalog page — `CatalogHeader` owns the cover and
 * category rail above it, this owns the grid and pager below.
 *
 * Same degrade contract as `CatalogHeader`/`HomeNewProducts`: only `ApiError`
 * is swallowed (a genuine bug still surfaces) — a catalog without products
 * isn't a catalog.
 */
export async function CatalogProductSection({
  catalog,
  categoryId,
  filters,
  page,
  basePath,
  emptyMessage,
  noGutter,
  colorSwatchIndex,
}: CatalogProductSectionProps) {
  const productsResult = await getPublicCatalogProducts({
    catalog,
    ...(categoryId ? { categoryId } : {}),
    ...(filters ? { filters } : {}),
    page,
  }).catch((error) => {
    if (!(error instanceof ApiError)) throw error;
    return { products: [], page: 1, pages: 1, total: 0 };
  });

  const productsWithImage = productsResult.products.filter((product) => product.gallery.length > 0);
  // On a `/[slug]` page `filters.categories` is normally empty — the
  // sidebar hides its own Categoría/Grupo groups there
  // (`CatalogFilterGroups`'s `hideCategoryFilter`), since the route's own
  // `categoryId` above already fixes it. On the index pages, a `category`
  // the sidebar did set flows through here like any other filter.
  const filterQuery = filters ? serializeFilterState(filters).toString() : undefined;

  return (
    <>
      <CatalogProductGrid
        products={productsWithImage}
        colorSwatchIndex={colorSwatchIndex}
        emptyMessage={emptyMessage}
        noGutter={noGutter}
      />
      <CatalogPagination
        basePath={basePath}
        page={productsResult.page}
        pages={productsResult.pages}
        filterQuery={filterQuery}
      />
    </>
  );
}
