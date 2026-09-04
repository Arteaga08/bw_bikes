"use client";

import type { AdminBrand, AdminInventoryProductRow as AdminInventoryProductRowData, ColorTemplate, ItemType } from "@bw-bikes/shared";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tab, TabList } from "@/components/ui/Tabs";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { adminColorTemplatesApi } from "@/lib/api/admin-catalog";
import type { CategoryTreeNode } from "@/lib/api/admin-catalog";
import type { AdminInventoryProductListParams } from "@/lib/api/admin-inventory";
import { listAdminInventoryProducts } from "@/lib/api/admin-inventory";
import { DEFAULT_INVENTORY_FILTERS, InventoryFilters, type InventoryFiltersValue } from "./InventoryFilters";
import { InventoryProductRow } from "./InventoryProductRow";
import { InventoryStatusChips, type InventoryStockFilter } from "./InventoryStatusChips";

// Same lazy-mount rationale `StockAdjustDialog`/`NewInventoryEntryDialog`
// documented before this redesign: gated on `everOpenedDetail` rather than
// mounted unconditionally, so the code-split chunk only starts loading once
// an admin actually opens a product, not on every visit to this screen.
const ProductInventoryModal = dynamic(
  () => import("./ProductInventoryModal").then((mod) => mod.ProductInventoryModal),
  { ssr: false },
);

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

export interface InventarioViewProps {
  bikeCategoryTree: CategoryTreeNode[];
  accessoryCategoryTree: CategoryTreeNode[];
  brands: AdminBrand[];
}

function ProductRowSkeleton() {
  return (
    <div className="flex items-center gap-md border-b border-borde p-md last:border-b-0">
      <Skeleton className="h-16 w-16 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-xs">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-8 w-12 shrink-0" />
    </div>
  );
}

/**
 * The orchestrator: filters → status chips → flat paginated product list →
 * detail modal — the product-first redesign of what used to be three
 * `StatCard`s, a SKU-level "Por categoría" accordion, and two separate
 * dialogs (`StockAdjustDialog`, `NewInventoryEntryDialog`). Same
 * filters-then-list template `CatalogView` already establishes for the rest
 * of the panel, extended with the `Bicicletas`/`Accesorios` split this
 * screen still needs (bikes and accessories are two independent catalogs and
 * category trees).
 *
 * Search and the status chip are no longer mutually exclusive — both are
 * independent params on the same `/admin/inventory/products` endpoint, so
 * there is nothing to arbitrate between them the way SKU search and the old
 * alert cards used to.
 */
export function InventarioView({ bikeCategoryTree, accessoryCategoryTree, brands }: InventarioViewProps) {
  const [catalogTab, setCatalogTab] = useState<ItemType>("bike");
  const [filters, setFilters] = useState<InventoryFiltersValue>(DEFAULT_INVENTORY_FILTERS);
  const [stockFilter, setStockFilter] = useState<InventoryStockFilter | null>(null);
  const [page, setPage] = useState(1);
  const [refetchToken, setRefetchToken] = useState(0);

  const debouncedSearch = useDebouncedValue(filters.search, SEARCH_DEBOUNCE_MS);

  const [products, setProducts] = useState<AdminInventoryProductRowData[]>([]);
  const [counts, setCounts] = useState<{ all: number; out: number; low: number; ok: number; onRequest: number } | null>(null);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [openProduct, setOpenProduct] = useState<AdminInventoryProductRowData | null>(null);
  const [everOpenedDetail, setEverOpenedDetail] = useState(false);
  const [colorTemplatesByValue, setColorTemplatesByValue] = useState<Map<string, ColorTemplate>>(new Map());

  const categoryTree = catalogTab === "bike" ? bikeCategoryTree : accessoryCategoryTree;

  const effectiveParams: AdminInventoryProductListParams = useMemo(
    () => ({
      itemType: catalogTab,
      page,
      limit: PAGE_SIZE,
      sort: filters.sort,
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.brand.trim() ? { brand: filters.brand.trim() } : {}),
      ...(stockFilter ? { stock: stockFilter } : {}),
    }),
    [catalogTab, page, filters.sort, filters.category, filters.brand, debouncedSearch, stockFilter],
  );

  // "Adjust state during render" — the same pattern `CatalogView` documents:
  // a genuine change resets to the loading state right here, in the render
  // body, so a plain `refetch()` after a modal mutation doesn't flash a
  // full-page skeleton.
  const requestKey = JSON.stringify(effectiveParams);
  const [lastRequestKey, setLastRequestKey] = useState<string | null>(null);
  if (requestKey !== lastRequestKey) {
    setLastRequestKey(requestKey);
    setLoading(true);
    setLoadError(false);
  }

  useEffect(() => {
    let cancelled = false;
    listAdminInventoryProducts(effectiveParams)
      .then((result) => {
        if (cancelled) return;
        setProducts(result.data.products);
        setCounts(result.data.counts);
        setMeta(result.meta ?? { total: result.data.products.length, page: 1, pages: 1, limit: PAGE_SIZE });
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveParams, refetchToken]);

  function refetch(): void {
    setRefetchToken((token) => token + 1);
  }

  function handleTabChange(next: ItemType): void {
    setCatalogTab(next);
    // The previous `category` id belongs to the tab's own tree — carrying it
    // over would silently filter the other catalog by an id it never had.
    setFilters((current) => ({ ...current, category: "" }));
    setStockFilter(null);
    setPage(1);
  }

  function updateFilters(next: InventoryFiltersValue): void {
    setFilters(next);
    setPage(1);
  }

  function toggleStockFilter(filter: InventoryStockFilter): void {
    setStockFilter((current) => (current === filter ? null : filter));
    setPage(1);
  }

  const handleOpenProduct = useCallback((product: AdminInventoryProductRowData) => {
    setEverOpenedDetail(true);
    setOpenProduct(product);
  }, []);

  useEffect(() => {
    if (!everOpenedDetail || colorTemplatesByValue.size > 0) return;
    adminColorTemplatesApi.list({ limit: 100 }).then((result) => {
      setColorTemplatesByValue(new Map(result.data.map((template) => [template.value.toLowerCase(), template])));
    });
  }, [everOpenedDetail, colorTemplatesByValue.size]);

  return (
    <div className="flex flex-col gap-lg p-md sm:p-lg">
      <InventoryStatusChips counts={counts} activeFilter={stockFilter} onToggleFilter={toggleStockFilter} />

      <div className="flex flex-col gap-sm sm:flex-row sm:items-end sm:justify-between">
        <TabList label="Catálogo">
          <Tab selected={catalogTab === "bike"} onSelect={() => handleTabChange("bike")}>
            Bicicletas
          </Tab>
          <Tab selected={catalogTab === "accessory"} onSelect={() => handleTabChange("accessory")}>
            Accesorios
          </Tab>
        </TabList>

        <InventoryFilters value={filters} onChange={updateFilters} categoryTree={categoryTree} brands={brands} />
      </div>

      <ErrorBoundary>
        <div className="rounded-card border border-borde bg-surface">
          {loading ? (
            Array.from({ length: 6 }, (_, index) => <ProductRowSkeleton key={index} />)
          ) : loadError ? (
            <EmptyState
              title="No se pudo cargar el inventario"
              description="Ocurrió un problema al conectar con el servidor."
              action={
                <Button variant="ghost" onClick={refetch}>
                  Reintentar
                </Button>
              }
            />
          ) : products.length === 0 ? (
            <EmptyState title="Sin productos con estos filtros" description="Ajusta los filtros de búsqueda, marca o categoría." />
          ) : (
            products.map((product) => (
              <InventoryProductRow key={product.itemId} product={product} onOpen={handleOpenProduct} />
            ))
          )}
        </div>
      </ErrorBoundary>

      <Pagination meta={meta} onPageChange={setPage} />

      {everOpenedDetail ? (
        <ProductInventoryModal
          product={openProduct}
          onClose={() => setOpenProduct(null)}
          onMutated={refetch}
          colorTemplatesByValue={colorTemplatesByValue}
        />
      ) : null}
    </div>
  );
}
