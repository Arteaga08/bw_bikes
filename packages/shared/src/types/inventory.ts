import type { FulfillmentMode, ItemType } from "./catalog.js";

/**
 * Lifecycle of a stock reservation.
 *
 * - `held` — units are subtracted from availability but still physically in
 *   stock. This is the only non-terminal state.
 * - `committed` — the sale went through; the units left the warehouse.
 * - `released` — the hold was given back (payment failed, checkout abandoned,
 *   or the reservation expired).
 *
 * Both terminal states are reached by an **atomic claim** on this very field
 * (`{ _id, status: "held" }`), which is what makes release/commit idempotent
 * and safe to race between the normal flow and the expiry job.
 */
export type ReservationStatus = "held" | "committed" | "released";

/** What holds the reservation. `cart` and `order` both land in M5. */
export type ReservationReferenceType = "cart" | "order";

/**
 * The two counters an inventory row keeps, plus the derived number everything
 * else actually cares about. `onHand` is physical stock, `reserved` is what
 * in-flight checkouts have set aside — never a single counter for both, or a
 * reservation and a sale become indistinguishable.
 */
export interface InventoryAvailability {
  itemType: ItemType;
  itemId: string;
  sku: string;
  onHand: number;
  reserved: number;
  /** `onHand - reserved`. Always computed, never stored. */
  available: number;
}

/** What an inventory row is stock *for* — resolved by joining `itemId`/`sku` against the catalog at read time, never stored on the row itself. `null` when the product (or that specific variant) no longer exists. */
export interface AdminInventoryProductInfo {
  name: string;
  brand: string;
  /** The primary gallery image's delivery URL (lowest `order`) — already a full Cloudinary URL, same field every other admin list renders directly, never rebuilt from a bare `publicId`. */
  imageUrl?: string;
}

export interface AdminInventoryVariantInfo {
  size?: string;
  color?: string;
  fulfillmentMode: FulfillmentMode;
}

/**
 * What `GET /admin/inventory` and its siblings return — `InventoryAvailability`
 * plus everything the panel needs to render a row without a second round trip.
 *
 * `lowStockThresholdUnits` is the **effective** threshold for this SKU: its own
 * override if one was set, otherwise `Settings.inventory.lowStockThresholdUnits`
 * — the caller never has to resolve that fallback itself.
 */
export interface AdminInventoryItem extends InventoryAvailability {
  id: string;
  product: AdminInventoryProductInfo | null;
  variant: AdminInventoryVariantInfo | null;
  lowStockThresholdUnits: number;
  /** ISO timestamp of the last positive `delta` adjustment. Absent if the row has never been restocked since creation. */
  lastRestockedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** One root category's rollup, for the inventory panel's category bands — sized to avoid fetching every row just to paint a header. */
export interface InventorySummaryGroup {
  itemType: ItemType;
  categoryId: string;
  categoryName: string;
  totalSkus: number;
  outOfStockSkus: number;
  lowStockSkus: number;
}

/** Store-wide rollup, independent of category — feeds the alert cards atop `/admin/inventario`. */
export interface InventorySummaryTotals {
  totalSkus: number;
  outOfStockSkus: number;
  lowStockSkus: number;
  /** Rows created within the panel's "recent" window (see `inventory.service.ts`). */
  newSkus: number;
}

export interface InventorySummary {
  groups: InventorySummaryGroup[];
  totals: InventorySummaryTotals;
}
