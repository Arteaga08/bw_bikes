import type { FulfillmentMode, ItemType, OrderLineSnapshot } from "@bw-bikes/shared";
import { Schema } from "mongoose";
import { MAX_BRAND_LENGTH, MAX_PRODUCT_NAME_LENGTH } from "../bike.model.js";
import {
  MAX_COLOR_LENGTH,
  MAX_PRICE_CENTS,
  MAX_SIZE_LENGTH,
  MAX_SKU_LENGTH,
} from "./product-variant.schema.js";
import { MAX_RESERVATION_QTY } from "../stock-reservation.model.js";

/** A single order with more distinct lines than this is not a real purchase. */
export const MAX_ORDER_LINES = 20;

/**
 * A purchased line, frozen at checkout.
 *
 * Every display field — name, brand, size, colour, image — is **copied**, not
 * referenced. The order module never reads the catalog again, which is what
 * lets the two independent catalogs (bikes and accessories) feed one
 * transactional engine without their schemas leaking into it, and what
 * guarantees that a price change, a rename, or an archived product cannot
 * rewrite a purchase that already happened.
 *
 * `itemId` and `sku` are kept so inventory can be committed and reporting can
 * group by product — never to re-resolve what to show.
 *
 * `_id: false`: a line is identified by its SKU within the order, and an extra
 * ObjectId per line would only invite code to treat lines as addressable
 * sub-resources. They are not; an order is immutable once created.
 */
export const orderLineSchema = new Schema<OrderLineSnapshot>(
  {
    itemType: { type: String, enum: ["bike", "accessory"] satisfies ItemType[], required: true },
    itemId: { type: String, required: true },
    sku: { type: String, required: true, trim: true, uppercase: true, maxlength: MAX_SKU_LENGTH },

    name: { type: String, required: true, trim: true, maxlength: MAX_PRODUCT_NAME_LENGTH },
    brand: { type: String, required: true, trim: true, maxlength: MAX_BRAND_LENGTH },
    size: { type: String, trim: true, maxlength: MAX_SIZE_LENGTH },
    color: { type: String, trim: true, maxlength: MAX_COLOR_LENGTH },
    imagePublicId: { type: String, trim: true },

    // Frozen too, and not for display: this is the field that decided whether
    // the whole order was captured immediately or merely authorized. Six months
    // later, when someone asks why a customer was not charged on the spot, the
    // answer has to be readable on the order itself.
    fulfillmentMode: {
      type: String,
      enum: ["in_stock", "on_request", "preorder"] satisfies FulfillmentMode[],
      required: true,
    },

    unitPriceCents: { type: Number, required: true, min: 0, max: MAX_PRICE_CENTS },
    qty: { type: Number, required: true, min: 1, max: MAX_RESERVATION_QTY },
    lineTotalCents: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);
