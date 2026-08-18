"use client";

import type { AdminInventoryItem, InventorySummary, ItemType } from "@bw-bikes/shared";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ComboboxOption } from "@/components/ui/Combobox";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tab, TabList } from "@/components/ui/Tabs";
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
import { InventoryRow } from "./InventoryRow";
import { NewInventoryEntryDialog } from "./NewInventoryEntryDialog";
import { StockAdjustDialog } from "./StockAdjustDialog";

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * Three zones of decreasing weight, per the `impeccable`-shaped brief:
 * Reposición (dominant — the reorder list itself, not a count), Por
 * categoría (bandas asimétricas, dos árboles independientes), Captura
 * (un solo dorado en toda la vista). Refetching is coarse on purpose — one
 * `refetchToken` bumped after any mutation reloads the summary, Zona 1, and
 * whichever category bands are open, the same "refetch, never optimistic
 * update" discipline every other screen in this panel follows.
 */
export function InventarioView() {
  const { toast } = useToast();

  const [catalogTab, setCatalogTab] = useState<ItemType>("bike");
  const [refetchToken, setRefetchToken] = useState(0);

  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [replenishRows, setReplenishRows] = useState<AdminInventoryItem[]>([]);
  const [replenishLoading, setReplenishLoading] = useState(true);
  const [replenishError, setReplenishError] = useState(false);

  const [bikeOptions, setBikeOptions] = useState<ComboboxOption[]>([]);
  const [accessoryOptions, setAccessoryOptions] = useState<ComboboxOption[]>([]);

  const [adjustTarget, setAdjustTarget] = useState<AdminInventoryItem | null>(null);
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [newEntrySubmitting, setNewEntrySubmitting] = useState(false);

  function refetch(): void {
    setRefetchToken((token) => token + 1);
  }

  // "Adjust state during render" — a `refetchToken` bump resets both loading
  // flags right here, in the render body; the two effects below only ever
  // call setState in response to their fetch actually settling.
  const [lastRefetchToken, setLastRefetchToken] = useState(refetchToken);
  if (refetchToken !== lastRefetchToken) {
    setLastRefetchToken(refetchToken);
    setSummaryLoading(true);
    setReplenishLoading(true);
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
    let cancelled = false;
    Promise.all([
      listAdminInventory({ stock: "out", limit: 50, sort: "available" }),
      listAdminInventory({ stock: "low", limit: 50, sort: "available" }),
    ])
      .then(([out, low]) => {
        if (cancelled) return;
        setReplenishRows([...out.data.items, ...low.data.items]);
        setReplenishError(false);
      })
      .catch(() => {
        if (!cancelled) setReplenishError(true);
      })
      .finally(() => {
        if (!cancelled) setReplenishLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refetchToken]);

  useEffect(() => {
    Promise.all([
      adminBikesApi.list({ limit: 100, sort: "name" }),
      adminAccessoriesApi.list({ limit: 100, sort: "name" }),
    ]).then(([bikes, accessories]) => {
      setBikeOptions(bikes.data.map((bike) => ({ id: bike.id, label: bike.name })));
      setAccessoryOptions(accessories.data.map((accessory) => ({ id: accessory.id, label: accessory.name })));
    });
  }, []);

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

  return (
    <div className="flex flex-col gap-xl p-md sm:p-lg">
      <Button variant="primary" onClick={() => setNewEntryOpen(true)} className="self-start">
        Registrar entrada
      </Button>

      {/* Zona 1 · Reposición — dominante */}
      <section className="flex flex-col gap-md">
        <h2 className="font-display text-h2 text-negro">Reposición</h2>
        <ErrorBoundary>
          {replenishLoading ? (
            <div className="flex flex-col gap-sm rounded-card border border-borde bg-surface p-md">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : replenishError ? (
            <EmptyState
              title="No se pudo cargar la reposición"
              description="Ocurrió un problema al conectar con el servidor."
              action={
                <Button variant="ghost" onClick={refetch}>
                  Reintentar
                </Button>
              }
            />
          ) : replenishRows.length === 0 ? (
            <EmptyState title="Todos los SKUs están por encima de su umbral" description="No hay nada que reponer por ahora." />
          ) : (
            <div className="rounded-card border border-borde bg-surface">
              {replenishRows.map((item) => (
                <InventoryRow key={item.id} item={item} onAdjust={setAdjustTarget} />
              ))}
            </div>
          )}
        </ErrorBoundary>
      </section>

      {/* Zona 2 · Por categoría — peso medio, dos árboles independientes */}
      <section className="flex flex-col gap-md">
        <h3 className="font-display text-h3 text-negro">Por categoría</h3>
        <TabList label="Catálogo">
          <Tab selected={catalogTab === "bike"} onSelect={() => setCatalogTab("bike")}>
            Bicicletas
          </Tab>
          <Tab selected={catalogTab === "accessory"} onSelect={() => setCatalogTab("accessory")}>
            Accesorios
          </Tab>
        </TabList>

        {summaryLoading ? (
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
                onAdjust={setAdjustTarget}
                refetchToken={refetchToken}
              />
            ))}
          </div>
        )}
      </section>

      <StockAdjustDialog
        item={adjustTarget}
        onClose={() => setAdjustTarget(null)}
        onConfirm={handleAdjustConfirm}
        submitting={adjustSubmitting}
      />

      <NewInventoryEntryDialog
        open={newEntryOpen}
        onClose={() => setNewEntryOpen(false)}
        onConfirm={handleNewEntryConfirm}
        submitting={newEntrySubmitting}
        bikeOptions={bikeOptions}
        accessoryOptions={accessoryOptions}
      />
    </div>
  );
}
