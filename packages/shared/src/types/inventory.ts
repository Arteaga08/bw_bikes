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

/** Store-wide rollup, independent of category. */
export interface InventorySummaryTotals {
  totalSkus: number;
  outOfStockSkus: number;
  lowStockSkus: number;
  /** Rows created within the panel's "recent" window (see `inventory.service.ts`). */
  newSkus: number;
}

export interface InventorySummary {
  totals: InventorySummaryTotals;
}

/**
 * The worst state any of a product's stock-holding variants is in — what the
 * product row's badge paints. `on_request` means the product declares no
 * `in_stock` variant at all, so it holds no physical stock and can never be
 * "agotado".
 *
 * A variant with no `InventoryItem` row yet is deliberately *not* counted as
 * out of stock: "sin registro" and "agotado" are different problems with
 * different fixes, and collapsing them would hide every newly created product
 * behind a red badge.
 */
export type InventoryProductStatus = "out" | "low" | "ok" | "on_request";

/** What both the product row and its detail carry — the product itself, resolved through the catalog. */
export interface AdminInventoryProductBase {
  itemType: ItemType;
  /** The `Bike`/`Accessory` `_id`. Every variant of the product shares it as `InventoryItem.itemId`, which is why grouping by product needs no schema change. */
  itemId: string;
  name: string;
  brand: string;
  categoryName: string;
  /** The primary gallery image's delivery URL (lowest `order`) — already a full Cloudinary URL, same as `AdminInventoryProductInfo.imageUrl`. */
  imageUrl?: string;
}

/**
 * One row of `GET /admin/inventory/products` — a **product**, never a SKU.
 * The list is driven off the catalog collections rather than `InventoryItem`
 * so that a row is always exactly one document: pagination stays exact, and
 * products that have no inventory rows at all are still visible.
 */
export interface AdminInventoryProductRow extends AdminInventoryProductBase {
  /** Active variants, whatever their `fulfillmentMode`. */
  variantCount: number;
  /** Active `in_stock` variants that still have no `InventoryItem` row. */
  untrackedVariantCount: number;
  /** Sum of `available` across the tracked `in_stock` variants. `on_request`/`preorder` variants hold no stock and contribute nothing. */
  totalAvailable: number;
  totalOnHand: number;
  totalReserved: number;
  outOfStockVariants: number;
  lowStockVariants: number;
  status: InventoryProductStatus;
}

/**
 * Chip-row counts, computed over the same filtered set as the rows but
 * *before* the `stock` filter is applied — so "Agotados 5" stays readable
 * while the list is already narrowed to "Bajos". Products are partitioned by
 * worst status, so `out + low + ok + onRequest === all`.
 */
export interface AdminInventoryProductCounts {
  all: number;
  out: number;
  low: number;
  ok: number;
  onRequest: number;
}

/** One variant inside the product detail modal. */
export interface AdminInventoryVariantRow {
  /** `InventoryItem._id`, or `null` when this variant has no row yet — the panel creates one on the first entry. */
  inventoryItemId: string | null;
  sku: string;
  size?: string;
  color?: string;
  fulfillmentMode: FulfillmentMode;
  /** All zero when `inventoryItemId` is `null`: there is nothing counted yet, which is not the same as counting zero. */
  onHand: number;
  reserved: number;
  available: number;
  /** The **effective** threshold: the row's own override, otherwise `Settings.inventory.lowStockThresholdUnits`. */
  lowStockThresholdUnits: number;
  lastRestockedAt?: string;
}

/** What `GET /admin/inventory/products/:id` returns — every active variant, including the ones with no inventory row. */
export interface AdminInventoryProductDetail extends AdminInventoryProductBase {
  /** In the order the product declares them; the panel groups by `color` for display. */
  variants: AdminInventoryVariantRow[];
}

/** One SKU's public availability signal — no counts, just whether it can be sold right now. */
export interface PublicVariantAvailability {
  sku: string;
  isAvailable: boolean;
}

/** What `GET /catalog/availability` returns per requested `itemId`. */
export interface PublicProductAvailability {
  itemId: string;
  variants: PublicVariantAvailability[];
}
