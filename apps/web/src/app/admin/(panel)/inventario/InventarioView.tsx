"use client";

import type { AdminInventoryItem, InventorySummary, ItemType } from "@bw-bikes/shared";
import { X } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ComboboxOption } from "@/components/ui/Combobox";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tab, TabList } from "@/components/ui/Tabs";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useToast } from "@/hooks/use-toast";
import { adminAccessoriesApi, adminBikesApi } from "@/lib/api/admin-catalog";
import {
  adjustAdminInventoryStock,
  createAdminInventoryItem,
  getAdminInventorySummary,
  listAdminInventory,
} from "@/lib/api/admin-inventory";
import { ApiError } from "@/lib/api/error";
import { CategoryBand } from "./CategoryBand";
import { InventoryAlertCards, type InventoryStockFilter } from "./InventoryAlertCards";
import { InventoryRow } from "./InventoryRow";

// Code-split, gated on their own "ever opened" flag rather than mounted
// unconditionally — both dialogs used to always be in the tree (controlled
// by `item`/`open` props alone), which would have made a plain
// `next/dynamic` swap start loading their chunks on every visit to this
// screen regardless of whether the admin ever opens either one.
const NewInventoryEntryDialog = dynamic(
  () => import("./NewInventoryEntryDialog").then((mod) => mod.NewInventoryEntryDialog),
  { ssr: false },
);
const StockAdjustDialog = dynamic(() => import("./StockAdjustDialog").then((mod) => mod.StockAdjustDialog), {
  ssr: false,
});

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_RESULT_LIMIT = 50;

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

const STOCK_FILTER_LABELS: Record<InventoryStockFilter, string> = {
  out: "Agotados",
  low: "Bajos",
};

/**
 * Cards arriba (vistazo rapido, store-wide, clicables para filtrar) seguidas
 * por "Por categoria" como contenido dominante (dos arboles independientes,
 * bandas asimetricas) y Captura al final (un solo dorado en toda la vista).
 * Buscar por SKU y filtrar por una card son dos formas de acotar la misma
 * sección — activar una limpia la otra, para no combinar dos modos de
 * filtrado a la vez. Refetching is coarse on purpose - one `refetchToken`
 * bumped after any mutation reloads the summary and whichever category
 * bands are open, the same "refetch, never optimistic update" discipline
 * every other screen in this panel follows.
 */
export function InventarioView() {
  const { toast } = useToast();

  const [catalogTab, setCatalogTab] = useState<ItemType>("bike");
  const [refetchToken, setRefetchToken] = useState(0);
  const [stockFilter, setStockFilter] = useState<InventoryStockFilter | null>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const trimmedSearch = debouncedSearch.trim();
  const [searchResults, setSearchResults] = useState<AdminInventoryItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);

  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [bikeOptions, setBikeOptions] = useState<ComboboxOption[]>([]);
  const [accessoryOptions, setAccessoryOptions] = useState<ComboboxOption[]>([]);

  const [adjustTarget, setAdjustTarget] = useState<AdminInventoryItem | null>(null);
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  // Same lazy-mount rationale as `everOpenedNewEntry` below — `StockAdjustDialog`
  // used to be unconditionally in the tree (`item` alone gated its visible
  // state), so the code-split chunk would otherwise start loading the
  // moment this screen mounts, whether or not the admin ever adjusts stock.
  const [everOpenedAdjust, setEverOpenedAdjust] = useState(false);
  const handleAdjust = useCallback((item: AdminInventoryItem) => {
    setEverOpenedAdjust(true);
    setAdjustTarget(item);
  }, []);
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  // Same lazy-mount rationale as `OrdersView`'s `everOpenedDetail`: the two
  // product Combobox option lists below are only for this dialog, but used
  // to fetch 200 products (`limit: 100` × 2) on every mount of the page,
  // whether or not the admin ever opens "Nueva entrada".
  const [everOpenedNewEntry, setEverOpenedNewEntry] = useState(false);
  const [newEntrySubmitting, setNewEntrySubmitting] = useState(false);

  function refetch(): void {
    setRefetchToken((token) => token + 1);
  }

  function toggleStockFilter(filter: InventoryStockFilter): void {
    setSearch("");
    setStockFilter((current) => (current === filter ? null : filter));
  }

  function handleSearchChange(next: string): void {
    if (next.trim() !== "") setStockFilter(null);
    setSearch(next);
  }

  // "Adjust state during render" - a `refetchToken` bump resets the summary
  // loading flag right here, in the render body; the effect below only ever
  // calls setState in response to the fetch actually settling.
  const [lastRefetchToken, setLastRefetchToken] = useState(refetchToken);
  if (refetchToken !== lastRefetchToken) {
    setLastRefetchToken(refetchToken);
    setSummaryLoading(true);
  }

  // Same pattern for the search results: a change in the debounced term, the
  // active tab, or a mutation elsewhere invalidates the cached results here.
  const searchRequestKey = `${trimmedSearch}-${catalogTab}-${refetchToken}`;
  const [lastSearchRequestKey, setLastSearchRequestKey] = useState<string | null>(null);
  if (trimmedSearch !== "" && searchRequestKey !== lastSearchRequestKey) {
    setLastSearchRequestKey(searchRequestKey);
    setSearchLoading(true);
    setSearchError(false);
  }

  useEffect(() => {
    let cancelled = false;
    getAdminInventorySummary()
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refetchToken]);

  useEffect(() => {
    if (trimmedSearch === "") return;
    let cancelled = false;
    listAdminInventory({ itemType: catalogTab, search: trimmedSearch, limit: SEARCH_RESULT_LIMIT, sort: "available" })
      .then((result) => {
        if (cancelled) return;
        setSearchResults(result.data.items);
        setSearchError(false);
      })
      .catch(() => {
        if (!cancelled) setSearchError(true);
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trimmedSearch, catalogTab, refetchToken]);

  useEffect(() => {
    if (!everOpenedNewEntry) return;
    Promise.all([
      adminBikesApi.list({ limit: 100, sort: "name" }),
      adminAccessoriesApi.list({ limit: 100, sort: "name" }),
    ]).then(([bikes, accessories]) => {
      setBikeOptions(bikes.data.map((bike) => ({ id: bike.id, label: bike.name })));
      setAccessoryOptions(accessories.data.map((accessory) => ({ id: accessory.id, label: accessory.name })));
    });
  }, [everOpenedNewEntry]);

  async function handleAdjustConfirm(input: { delta: number } | { onHand: number }, reason: string): Promise<void> {
    if (!adjustTarget) return;
    setAdjustSubmitting(true);
    try {
      await adjustAdminInventoryStock(adjustTarget.id, { ...input, reason });
      toast({ variant: "success", title: "Stock actualizado" });
      setAdjustTarget(null);
      refetch();
    } catch (error) {
      toast({ variant: "error", title: "No se pudo ajustar", description: apiErrorMessage(error, "Intenta de nuevo.") });
    } finally {
      setAdjustSubmitting(false);
    }
  }

  async function handleNewEntryConfirm(input: {
    itemType: ItemType;
    itemId: string;
    sku: string;
    onHand: number;
  }): Promise<void> {
    setNewEntrySubmitting(true);
    try {
      await createAdminInventoryItem(input);
      toast({ variant: "success", title: "Entrada registrada" });
      setNewEntryOpen(false);
      refetch();
    } catch (error) {
      toast({ variant: "error", title: "No se pudo registrar", description: apiErrorMessage(error, "Intenta de nuevo.") });
    } finally {
      setNewEntrySubmitting(false);
    }
  }

  const groupsByType = useMemo(() => {
    const groups = summary?.groups ?? [];
    return {
      bike: groups.filter((group) => group.itemType === "bike"),
      accessory: groups.filter((group) => group.itemType === "accessory"),
    };
  }, [summary]);

  const isSearching = trimmedSearch !== "";

  return (
    <div className="flex flex-col gap-xl p-md sm:p-lg">
      <InventoryAlertCards totals={summary?.totals ?? null} activeFilter={stockFilter} onToggleFilter={toggleStockFilter} />

      {/* Por categoria - contenido dominante de la pantalla, dos arboles independientes */}
      <section className="flex flex-col gap-md">
        <h2 className="font-display text-h2 text-negro">Por categoría</h2>

        <div className="flex flex-col gap-sm sm:flex-row sm:items-end sm:justify-between">
          <TabList label="Catálogo">
            <Tab selected={catalogTab === "bike"} onSelect={() => setCatalogTab("bike")}>
              Bicicletas
            </Tab>
            <Tab selected={catalogTab === "accessory"} onSelect={() => setCatalogTab("accessory")}>
              Accesorios
            </Tab>
          </TabList>

          <Input
            label="Buscar"
            labelHidden
            placeholder="Buscar por SKU"
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            wrapperClassName="sm:max-w-[16rem]"
          />
        </div>

        {stockFilter && !isSearching ? (
          <button
            type="button"
            onClick={() => setStockFilter(null)}
            className="inline-flex w-fit items-center gap-xs rounded-control border border-borde bg-inset px-sm py-1 font-ui text-caption text-negro transition-colors duration-150 hover:bg-borde focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro"
          >
            Filtro: {STOCK_FILTER_LABELS[stockFilter]}
            <X size={12} weight="bold" aria-hidden="true" />
          </button>
        ) : null}

        {isSearching ? (
          <div className="rounded-card border border-borde bg-surface">
            {searchLoading ? (
              <div className="flex flex-col gap-sm p-md">
                {Array.from({ length: 3 }, (_, index) => (
                  <Skeleton key={index} className="h-16 w-full" />
                ))}
              </div>
            ) : searchError ? (
              <EmptyState
                title="No se pudo buscar"
                description="Ocurrió un problema al conectar con el servidor."
                action={
                  <Button variant="ghost" onClick={refetch}>
                    Reintentar
                  </Button>
                }
              />
            ) : searchResults.length === 0 ? (
              <EmptyState title="Sin resultados" description={`Ningún SKU coincide con "${trimmedSearch}".`} />
            ) : (
              searchResults.map((item) => (
                <InventoryRow key={item.id} item={item} onAdjust={handleAdjust} density="comfortable" />
              ))
            )}
          </div>
        ) : summaryLoading ? (
          <div className="flex flex-col gap-sm rounded-card border border-borde bg-surface p-md">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : groupsByType[catalogTab].length === 0 ? (
          <EmptyState title="Sin categorías" description="Crea una categoría en el catálogo para verla aquí." />
        ) : (
          <div className="rounded-card border border-borde bg-surface">
            {groupsByType[catalogTab].map((group) => (
              <CategoryBand
                key={`${group.itemType}-${group.categoryId}`}
                group={group}
                onAdjust={handleAdjust}
                refetchToken={refetchToken}
                stockFilter={stockFilter}
              />
            ))}
          </div>
        )}
      </section>

      {/* Captura - la mas ligera, sin card ni heading propio: el unico dorado de la vista */}
      <Button
        variant="primary"
        onClick={() => {
          setEverOpenedNewEntry(true);
          setNewEntryOpen(true);
        }}
        className="self-start"
      >
        Registrar entrada
      </Button>

      {everOpenedAdjust ? (
        <StockAdjustDialog
          item={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onConfirm={handleAdjustConfirm}
          submitting={adjustSubmitting}
        />
      ) : null}

      {everOpenedNewEntry ? (
        <NewInventoryEntryDialog
          open={newEntryOpen}
          onClose={() => setNewEntryOpen(false)}
          onConfirm={handleNewEntryConfirm}
          submitting={newEntrySubmitting}
          bikeOptions={bikeOptions}
          accessoryOptions={accessoryOptions}
        />
      ) : null}
    </div>
  );
}
