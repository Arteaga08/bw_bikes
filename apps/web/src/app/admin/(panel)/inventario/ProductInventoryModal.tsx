"use client";

import type {
  AdminInventoryItem,
  AdminInventoryProductDetail,
  AdminInventoryProductRow as AdminInventoryProductRowData,
  AdminInventoryVariantRow,
  ColorTemplate,
} from "@bw-bikes/shared";
import { Image as ImageIcon } from "@phosphor-icons/react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/hooks/use-toast";
import type { AdjustStockInput } from "@/lib/api/admin-inventory";
import { adjustAdminInventoryStock, createAdminInventoryItem, getAdminInventoryProductDetail } from "@/lib/api/admin-inventory";
import { ApiError } from "@/lib/api/error";
import { VariantColorGroup } from "./VariantColorGroup";

export interface ProductInventoryModalProps {
  /** The row that was clicked — supplies `itemType`/`itemId` immediately and a header to paint while the detail request is in flight. `null` closes the modal. */
  product: AdminInventoryProductRowData | null;
  onClose: () => void;
  /** Called exactly once, on close, and only if at least one adjustment succeeded — bumps the list's `refetchToken` without refetching on every click inside the modal. */
  onMutated: () => void;
  /** Value (lowercased) → template, for the color swatches. Fetched once by `InventarioView` on first open, not per modal open. */
  colorTemplatesByValue: Map<string, ColorTemplate>;
}

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

const NO_COLOR_KEY = "__sin_color__";

/**
 * The detail view the redesign's brief asked for: photo, name, brand,
 * categoría, then every variant grouped by color with an inline stepper —
 * no second `Modal` opened on top (`Modal` traps focus and owns the Escape
 * key at the `document` level, so two mounted at once would fight over
 * both). Adjustments apply against the **server's** response, never
 * optimistically — the same "refetch, never assume" discipline every other
 * screen in this panel follows, just scoped to one variant instead of the
 * whole list.
 */
export function ProductInventoryModal({ product, onClose, onMutated, colorTemplatesByValue }: ProductInventoryModalProps) {
  const { toast } = useToast();

  const [detail, setDetail] = useState<AdminInventoryProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pendingSku, setPendingSku] = useState<string | null>(null);
  const [mutated, setMutated] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");

  // "Adjust state during render", same pattern the rest of this panel's
  // lists use (`CatalogView`, the old `InventarioView`): a genuinely new
  // product resets the loading state right here, in the render body — the
  // effect below only ever calls `setState` in response to the fetch it
  // started actually settling, never synchronously in the effect body
  // (react-hooks/set-state-in-effect).
  const productKey = product ? `${product.itemType}:${product.itemId}` : null;
  const [lastProductKey, setLastProductKey] = useState<string | null>(null);
  if (productKey !== lastProductKey) {
    setLastProductKey(productKey);
    if (productKey) {
      setLoading(true);
      setLoadError(false);
    }
  }

  useEffect(() => {
    if (!product) return;
    let cancelled = false;
    getAdminInventoryProductDetail(product.itemType, product.itemId)
      .then((result) => {
        if (cancelled) return;
        setDetail(result);
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
  }, [product]);

  function handleClose(): void {
    if (mutated) onMutated();
    setDetail(null);
    setLoading(true);
    setLoadError(false);
    setPendingSku(null);
    setMutated(false);
    setLiveMessage("");
    onClose();
  }

  function applyServerItem(sku: string, item: AdminInventoryItem): void {
    setDetail((current) =>
      current
        ? {
            ...current,
            variants: current.variants.map((variant) =>
              variant.sku === sku
                ? {
                    ...variant,
                    inventoryItemId: item.id,
                    onHand: item.onHand,
                    reserved: item.reserved,
                    available: item.available,
                    lowStockThresholdUnits: item.lowStockThresholdUnits,
                    ...(item.lastRestockedAt ? { lastRestockedAt: item.lastRestockedAt } : {}),
                  }
                : variant,
            ),
          }
        : current,
    );
    setLiveMessage(`${sku}: ${item.available} disponibles.`);
    setMutated(true);
  }

  async function refetchDetail(): Promise<void> {
    if (!product) return;
    try {
      setDetail(await getAdminInventoryProductDetail(product.itemType, product.itemId));
    } catch {
      setLoadError(true);
    }
  }

  async function runMutation(sku: string, action: () => Promise<AdminInventoryItem>): Promise<void> {
    setPendingSku(sku);
    try {
      applyServerItem(sku, await action());
    } catch (error) {
      toast({ variant: "error", title: "No se pudo ajustar", description: apiErrorMessage(error, "Intenta de nuevo.") });
      await refetchDetail();
    } finally {
      setPendingSku(null);
    }
  }

  function handleIncrement(variant: AdminInventoryVariantRow, amount: number): void {
    if (!product) return;
    void runMutation(variant.sku, () =>
      variant.inventoryItemId
        ? adjustAdminInventoryStock(variant.inventoryItemId, { delta: amount })
        : createAdminInventoryItem({ itemType: product.itemType, itemId: product.itemId, sku: variant.sku, onHand: amount }),
    );
  }

  function handleDecrement(variant: AdminInventoryVariantRow, amount: number): void {
    if (!variant.inventoryItemId) return; // the row disables this control for an untracked variant — nothing to subtract from yet
    void runMutation(variant.sku, () => adjustAdminInventoryStock(variant.inventoryItemId!, { delta: -amount }));
  }

  function handleAdjustSubmit(
    variant: AdminInventoryVariantRow,
    input: { delta: number } | { onHand: number },
    reason: string | undefined,
  ): Promise<void> {
    if (!variant.inventoryItemId) return Promise.resolve();
    const payload = { ...input, ...(reason !== undefined ? { reason } : {}) } as AdjustStockInput;
    return runMutation(variant.sku, () => adjustAdminInventoryStock(variant.inventoryItemId!, payload));
  }

  const groups: { key: string; colorName: string | null; variants: AdminInventoryVariantRow[] }[] = [];
  if (detail) {
    const byKey = new Map<string, { colorName: string | null; variants: AdminInventoryVariantRow[] }>();
    for (const variant of detail.variants) {
      const key = variant.color ?? NO_COLOR_KEY;
      const entry = byKey.get(key);
      if (entry) entry.variants.push(variant);
      else byKey.set(key, { colorName: variant.color ?? null, variants: [variant] });
    }
    groups.push(...[...byKey.entries()].map(([key, value]) => ({ key, ...value })));
  }

  const headerImage = detail?.imageUrl ?? product?.imageUrl;
  const headerName = detail?.name ?? product?.name ?? "";
  const headerBrand = detail?.brand ?? product?.brand ?? "";
  const headerCategory = detail?.categoryName ?? product?.categoryName ?? "";
  const totalAvailable = detail ? detail.variants.reduce((sum, variant) => sum + variant.available, 0) : 0;

  return (
    <Modal open={product !== null} onClose={handleClose} title={headerName || "Producto"} size="lg">
      <p aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      {product ? (
        <div className="flex flex-col gap-md">
          <div className="flex items-center gap-md border-b border-borde pb-md">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-control bg-inset">
              {headerImage ? (
                <Image src={headerImage} alt={headerName} fill sizes="96px" className="object-cover" />
              ) : (
                <ImageIcon size={32} weight="light" aria-hidden="true" className="text-grafito opacity-40" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-body text-caption text-grafito">
                {headerBrand} · {headerCategory}
              </p>
              {detail ? (
                <p className="font-body text-body text-grafito">
                  {totalAvailable} disponibles en {detail.variants.length} {detail.variants.length === 1 ? "variante" : "variantes"}
                </p>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col gap-sm">
              {Array.from({ length: 2 }, (_, index) => (
                <Skeleton key={index} className="h-24 w-full" />
              ))}
            </div>
          ) : loadError ? (
            <EmptyState
              title="No se pudo cargar el producto"
              description="Ocurrió un problema al conectar con el servidor."
              action={
                <Button variant="ghost" onClick={() => void refetchDetail()}>
                  Reintentar
                </Button>
              }
            />
          ) : groups.length === 0 ? (
            <EmptyState title="Sin variantes activas" description="Este producto no tiene variantes activas para llevar stock." />
          ) : (
            <div className="flex flex-col gap-md">
              {groups.map((group) => (
                <VariantColorGroup
                  key={group.key}
                  colorName={group.colorName}
                  hex={group.colorName ? (colorTemplatesByValue.get(group.colorName.toLowerCase())?.hex ?? null) : null}
                  secondaryHex={group.colorName ? colorTemplatesByValue.get(group.colorName.toLowerCase())?.secondaryHex : null}
                  variants={group.variants}
                  pendingSku={pendingSku}
                  onIncrement={handleIncrement}
                  onDecrement={handleDecrement}
                  onAdjustSubmit={handleAdjustSubmit}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
