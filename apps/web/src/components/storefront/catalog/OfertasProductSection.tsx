import type { PublicColorSwatch } from "@/lib/api/public-catalog";
import { getPublicOnSaleProducts } from "@/lib/api/public-catalog";
import { ApiError } from "@/lib/api/error";
import { serializeFilterState, type CatalogFilterState } from "@/lib/storefront-catalog-filters";
import { CatalogPagination } from "./CatalogPagination";
import { CatalogProductGrid } from "./CatalogProductGrid";

export interface OfertasProductSectionProps {
  filters: CatalogFilterState;
  page: number;
  /** Already built at the page level from the merged bike+accessory filter options (`mergeCatalogFilterOptions`) — unlike `CatalogProductSection`, this never fetches swatches itself, since "Ofertas" has no single `CatalogKind` to key that fetch on. */
  colorSwatchIndex: Map<string, PublicColorSwatch>;
  emptyMessage: string;
}

/**
 * The `/ofertas` twin of `CatalogProductSection` — same grid/pager, but
 * backed by the merged bike+accessory read (`getPublicOnSaleProducts`)
 * instead of one catalog's own paginated list. Kept as its own component
 * rather than widening `CatalogProductSection`'s `catalog: CatalogKind` prop:
 * "Ofertas" isn't a third catalog with its own endpoints, it's a cross-catalog
 * view, and `CatalogKind`-keyed helpers (`getPublicCatalogProducts`,
 * `getPublicColorSwatches`) would need a special case each for it anyway.
 *
 * Same degrade contract as `CatalogProductSection`: only `ApiError` is
 * swallowed, and it degrades to an empty grid rather than losing the rest of
 * the page.
 */
export async function OfertasProductSection({ filters, page, colorSwatchIndex, emptyMessage }: OfertasProductSectionProps) {
  const productsResult = await getPublicOnSaleProducts({ filters, page }).catch((error) => {
    if (!(error instanceof ApiError)) throw error;
    return { products: [], page: 1, pages: 1, total: 0 };
  });

  const productsWithImage = productsResult.products.filter((product) => product.gallery.length > 0);
  const filterQuery = serializeFilterState(filters).toString();

  return (
    <>
      <CatalogProductGrid
        products={productsWithImage}
        colorSwatchIndex={colorSwatchIndex}
        emptyMessage={emptyMessage}
        noGutter
      />
      <CatalogPagination
        basePath="/ofertas"
        page={productsResult.page}
        pages={productsResult.pages}
        filterQuery={filterQuery}
      />
    </>
  );
}
