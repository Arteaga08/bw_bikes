import type { ItemType } from "./catalog.js";

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
