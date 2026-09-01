"use client";

import type { ItemType } from "@bw-bikes/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { addAccountWishlistItem, getAccountWishlist, removeAccountWishlistItem } from "@/lib/api/account";
import { ApiError } from "@/lib/api/error";

function wishlistKey(itemType: ItemType, itemId: string): string {
  return `${itemType}:${itemId}`;
}

interface WishlistContextValue {
  /** `undefined` until the initial hydration settles — lets `SaveButton` avoid flashing an unsaved heart before the real state is known. */
  isSignedIn: boolean | undefined;
  isSaved: (itemType: ItemType, itemId: string) => boolean;
  toggle: (itemType: ItemType, itemId: string) => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

/**
 * The signed-in customer's saved-product ids, hydrated once and kept in
 * memory (A5-guardados.md) — so a catalog page of 24 `SaveButton`s doesn't
 * fire 24 requests to find out which are already saved. Mounted in
 * `(storefront)/layout.tsx` alongside `CartProvider`, so it covers every
 * storefront page, signed in or not.
 *
 * A 401 from the hydration read means an anonymous visitor, not an error —
 * `getAccountWishlist` is called with `unauthorizedRedirectPath: null` for
 * exactly this reason, so it resolves to a catchable `ApiError` here instead
 * of bouncing the visitor to a login screen they never asked for.
 */
export function WishlistProvider({ children }: { children: ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState<boolean | undefined>(undefined);
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;

    getAccountWishlist()
      .then((entries) => {
        if (!active) return;
        setIsSignedIn(true);
        setIds(new Set(entries.map((entry) => wishlistKey(entry.itemType, entry.itemId))));
      })
      .catch((error) => {
        if (!active) return;
        setIsSignedIn(error instanceof ApiError && error.httpStatus === 401 ? false : undefined);
      });

    return () => {
      active = false;
    };
  }, []);

  const isSaved = useCallback((itemType: ItemType, itemId: string) => ids.has(wishlistKey(itemType, itemId)), [ids]);

  const toggle = useCallback(
    async (itemType: ItemType, itemId: string) => {
      const key = wishlistKey(itemType, itemId);
      if (ids.has(key)) {
        await removeAccountWishlistItem(itemType, itemId);
        setIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      } else {
        await addAccountWishlistItem({ itemType, itemId });
        setIds((prev) => new Set(prev).add(key));
      }
    },
    [ids],
  );

  const value = useMemo<WishlistContextValue>(() => ({ isSignedIn, isSaved, toggle }), [isSignedIn, isSaved, toggle]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist debe usarse dentro de WishlistProvider.");
  }
  return context;
}
