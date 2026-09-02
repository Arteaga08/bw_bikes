const STORAGE_KEY = "bw_checkout_idempotency";

interface StoredKey {
  key: string;
  cartUpdatedAt: string;
}

/**
 * Reuses the same `Idempotency-Key` across remounts of `/checkout/pago` as
 * long as `cart.updatedAt` hasn't changed since the key was generated — a F5
 * or a component remount then recovers the **same** order and `clientSecret`
 * instead of `cancelStalePendingOrders` (order.service.ts) tumbling the
 * previous `pending_payment` order and creating a second one.
 *
 * A different `cartUpdatedAt` (the customer went back to `/carrito` and
 * changed something) forces a fresh key: reusing the old one would make
 * `replayCheckout` (order.service.ts:438) hand back an order whose totals no
 * longer match what the cart currently shows.
 *
 * `sessionStorage`, not `localStorage` — the key belongs to this tab and this
 * visit to checkout, not something that should outlive it.
 */
export function checkoutIdempotencyKey(cartUpdatedAt: string): string {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const stored = JSON.parse(raw) as StoredKey;
      if (stored.cartUpdatedAt === cartUpdatedAt && stored.key) {
        return stored.key;
      }
    } catch {
      // Malformed value — fall through and mint a fresh one.
    }
  }

  const key = crypto.randomUUID();
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ key, cartUpdatedAt } satisfies StoredKey));
  return key;
}
