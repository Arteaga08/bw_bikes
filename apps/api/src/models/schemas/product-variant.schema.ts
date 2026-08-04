import type { FulfillmentMode } from "@bw-bikes/shared";
import { Schema } from "mongoose";

export const MAX_VARIANTS = 40;
export const MAX_SKU_LENGTH = 40;
export const MAX_SIZE_LENGTH = 16;
export const MAX_COLOR_LENGTH = 40;

/** $1,000,000.00 MXN in cents — a sanity ceiling, not a business rule. */
export const MAX_PRICE_CENTS = 100_000_000;

/**
 * A purchasable variant with its own SKU. This is the unit the transactional
 * layer references: M4's `InventoryItem` is keyed by `{ itemType, itemId, sku }`
 * and M5's cart/order lines carry the same triplet.
 *
 * Because `itemType` already disambiguates, a bike SKU that happens to equal
 * an accessory SKU is not ambiguous — uniqueness is enforced per collection
 * (see the index in each product model), not across both catalogs. A
 * cross-collection check would be racy anyway.
 *
 * `price` is optional and **overrides** the product-level price when present
 * (an XL frame or a limited-edition color that costs more). `fulfillmentMode`
 * lives here rather than on the product because the same bike can have one
 * size in stock and another only on request — which is exactly what drives
 * Stripe's manual-capture decision in M5.
 */
export const productVariantSchema = new Schema(
  {
    sku: { type: String, required: true, trim: true, uppercase: true, maxlength: MAX_SKU_LENGTH },
    size: { type: String, trim: true, maxlength: MAX_SIZE_LENGTH },
    color: { type: String, trim: true, maxlength: MAX_COLOR_LENGTH },
    price: { type: Number, min: 0, max: MAX_PRICE_CENTS },
    fulfillmentMode: {
      type: String,
      enum: ["in_stock", "on_request", "preorder"] satisfies FulfillmentMode[],
      required: true,
      default: "in_stock",
    },
    isActive: { type: Boolean, default: true },
  },
  { _id: false },
);
