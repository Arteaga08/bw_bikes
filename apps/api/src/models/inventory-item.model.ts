import type { ItemType } from "@bw-bikes/shared";
import { type Document, model, Schema, type Types } from "mongoose";
import { MAX_SKU_LENGTH } from "./schemas/product-variant.schema.js";

/** A sanity ceiling for a single SKU's physical stock, not a business rule. */
export const MAX_ON_HAND = 1_000_000;

/**
 * Physical stock for one purchasable variant, in its **own collection** rather
 * than embedded in the product (ECOMMERCE_ARCHITECTURE_GUIDELINES.md
 * §Inventario). Two reasons: the counters are written on a completely
 * different cadence than the catalog document, and a `$inc` on a small
 * dedicated document is the cheapest thing Mongo can serialize when two
 * buyers race for the last unit.
 *
 * Two counters, never one:
 * - `onHand`   — units physically in the warehouse.
 * - `reserved` — units an in-flight checkout has set aside.
 * - available  = `onHand - reserved`, always derived, never stored.
 *
 * Collapsing them into a single number would make "held for a checkout that
 * may still fail" indistinguishable from "sold", so an abandoned cart would
 * permanently destroy stock.
 *
 * ## Where the invariants actually live
 *
 * `min: 0` below protects `create()` and is documentation for the reader — it
 * does **not** run on the `$inc` updates the service issues, because Mongoose
 * validators don't apply to update operators. The real guarantee that
 * `onHand >= reserved >= 0` is the `$expr` condition inside every
 * `findOneAndUpdate` in `inventory.service.ts`, evaluated by Mongo in the same
 * atomic command as the increment.
 *
 * Rows are keyed by `{ itemType, itemId, sku }` — the triplet the whole
 * transactional layer uses to point at either catalog without merging their
 * schemas. `itemType` is what makes a bike SKU equal to an accessory SKU
 * unambiguous, which is why M3 enforces SKU uniqueness per collection instead
 * of globally.
 */
export interface IInventoryItem extends Document {
  itemType: ItemType;
  itemId: Types.ObjectId;
  sku: string;
  onHand: number;
  reserved: number;
  /** Per-SKU override of `Settings.inventory.lowStockThresholdUnits` (M11) — absent means "use the store-wide default". */
  lowStockThreshold?: number;
  /** Set only when `adjustStock` applies a positive `delta` — a physical recount (`onHand`) or a deduction is not a restock. Absent means never restocked since this row was created. */
  lastRestockedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const inventoryItemSchema = new Schema<IInventoryItem>(
  {
    itemType: {
      type: String,
      enum: ["bike", "accessory"] satisfies ItemType[],
      required: true,
    },
    itemId: { type: Schema.Types.ObjectId, required: true },
    sku: { type: String, required: true, trim: true, uppercase: true, maxlength: MAX_SKU_LENGTH },
    onHand: { type: Number, required: true, default: 0, min: 0, max: MAX_ON_HAND },
    reserved: { type: Number, required: true, default: 0, min: 0 },
    lowStockThreshold: { type: Number, min: 0, max: MAX_ON_HAND },
    lastRestockedAt: { type: Date },
  },
  { timestamps: true },
);

// One row per variant. Unique because a duplicate would split a SKU's stock
// across two documents and silently break every atomic guard: each half would
// see enough availability on its own.
inventoryItemSchema.index({ itemType: 1, itemId: 1, sku: 1 }, { unique: true });

// Serves the admin list's SKU search and the "all rows of this product" read.
inventoryItemSchema.index({ sku: 1 });

export const InventoryItem = model<IInventoryItem>("InventoryItem", inventoryItemSchema);
