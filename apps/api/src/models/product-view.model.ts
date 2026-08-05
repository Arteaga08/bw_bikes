import type { ItemType } from "@bw-bikes/shared";
import { type Document, model, Schema, type Types } from "mongoose";
import { MAX_SIZE_LENGTH, MAX_SKU_LENGTH } from "./schemas/product-variant.schema.js";

/**
 * How long a view event survives before Mongo's TTL drops it. Enough for a
 * 90-day preferences report; not a permanent visitor log — there is nothing
 * here to keep once the reporting window that could ever use it has passed.
 *
 * Fixed at index-creation time on purpose, **not** read from `Settings`:
 * `expireAfterSeconds` is baked into the index itself, so changing it would
 * mean dropping and recreating the index rather than writing a document —
 * a different operational category from the thresholds M7 moved to
 * `Settings`.
 */
export const PRODUCT_VIEW_RETENTION_DAYS = 90;

/**
 * An anonymous "someone looked at this product" event.
 *
 * Deliberately minimal: no `userId`, no IP, no user-agent. There is no
 * business reason to attribute a page view to a person — the preferences
 * report only ever aggregates counts — and privacy is a reason not to
 * collect what nobody needs. `sku`/`size` are optional because the event
 * fires from both the product page (no variant chosen yet) and a variant
 * selector.
 */
export interface IProductView extends Document {
  itemType: ItemType;
  itemId: Types.ObjectId;
  sku?: string;
  size?: string;
  occurredAt: Date;
}

const productViewSchema = new Schema<IProductView>(
  {
    itemType: { type: String, enum: ["bike", "accessory"] satisfies ItemType[], required: true },
    itemId: { type: Schema.Types.ObjectId, required: true },
    sku: { type: String, trim: true, uppercase: true, maxlength: MAX_SKU_LENGTH },
    size: { type: String, trim: true, maxlength: MAX_SIZE_LENGTH },
    occurredAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false },
);

// The preferences report's own query shape: "views of this product, in this window".
productViewSchema.index({ itemType: 1, itemId: 1, occurredAt: -1 });
productViewSchema.index(
  { occurredAt: 1 },
  { expireAfterSeconds: PRODUCT_VIEW_RETENTION_DAYS * 24 * 60 * 60 },
);

export const ProductView = model<IProductView>("ProductView", productViewSchema);
