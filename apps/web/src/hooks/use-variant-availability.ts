"use client";

import type { ItemType } from "@bw-bikes/shared";
import { useEffect, useState } from "react";
import { fetchVariantAvailability } from "@/lib/api/catalog-availability";

export type VariantAvailabilityStatus = "loading" | "ready" | "error";

export interface UseVariantAvailabilityResult {
  status: VariantAvailabilityStatus;
  /**
   * Fail-open: while loading, or if the network call itself failed, every SKU
   * reads as not sold out. The real guard against overselling stays
   * server-side (`addLine` in the cart) — this hook only decides whether the
   * storefront *shows* the "Agotado" state, never whether a sale is allowed.
   */
  isSoldOut: (sku: string) => boolean;
}

/** `itemIds` joined so the effect only re-fires when the actual set changes, not on every render's new array identity. */
export function useVariantAvailability(itemType: ItemType, itemIds: string[]): UseVariantAvailabilityResult {
  const key = itemIds.join(",");
  // An empty `itemIds` needs no request at all — "ready" from the first
  // render, not a `useEffect` that would set it synchronously.
  const [status, setStatus] = useState<VariantAvailabilityStatus>(key ? "loading" : "ready");
  const [availability, setAvailability] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (!key) return;

    let active = true;

    fetchVariantAvailability(itemType, key.split(","))
      .then((bySku) => {
        if (!active) return;
        setAvailability(bySku);
        setStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [itemType, key]);

  function isSoldOut(sku: string): boolean {
    if (status !== "ready") return false;
    return availability.get(sku) === false;
  }

  return { status, isSoldOut };
}
