import type { ItemType, ShippingAddress } from "@bw-bikes/shared";
import { type Document, model, Schema, type Types } from "mongoose";
import { MAX_SKU_LENGTH } from "./schemas/product-variant.schema.js";
import { shippingAddressSchema } from "./schemas/shipping-address.schema.js";
import { MAX_RESERVATION_QTY } from "./stock-reservation.model.js";

/** A cart with more distinct lines than this is a bug or an attack, not shopping. */
export const MAX_CART_LINES = 20;

/**
 * How long an untouched cart survives. Long enough that a customer can come
 * back next month and still find their bike selection; short enough that the
 * collection doesn't grow forever. It holds no stock, so nothing is lost by
 * keeping it and nothing is freed by dropping it.
 */
export const CART_TTL_DAYS = 90;

export interface ICartLine {
  itemType: ItemType;
  itemId: Types.ObjectId;
  sku: string;
  qty: number;
}

export interface ICart extends Document {
  userId: Types.ObjectId;
  lines: ICartLine[];
  /** Captured here, ahead of checkout, and copied onto the order at that point. */
  shippingAddress?: ShippingAddress;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A cart line stores **only what is being bought**, never for how much.
 *
 * No price, no name, no total. Everything displayed is re-read from the
 * catalog on every render (`resolveCartLines` in order-pricing.ts) and frozen
 * only when the order is created. A price cached here would be a price a
 * customer could hold on to across a price change — and, worse, a number the
 * checkout might be tempted to trust.
 */
const cartLineSchema = new Schema<ICartLine>(
  {
    itemType: { type: String, enum: ["bike", "accessory"] satisfies ItemType[], required: true },
    itemId: { type: Schema.Types.ObjectId, required: true },
    sku: { type: String, required: true, trim: true, uppercase: true, maxlength: MAX_SKU_LENGTH },
    qty: { type: Number, required: true, min: 1, max: MAX_RESERVATION_QTY },
  },
  { _id: false },
);

/**
 * One cart per customer, keyed by `userId` with a unique index.
 *
 * **Adding to the cart reserves nothing.** Stock is held only once an order is
 * created, for the short window in which the customer pays. Holding inventory
 * from the moment someone clicks "add" would let anyone empty the visible
 * catalog for free — and the shop sells bikes worth six figures, where a
 * handful of malicious carts is enough to look sold out.
 *
 * Accounts are mandatory in this shop, so there is no anonymous/session cart to
 * merge on login. That is a decision the client already made, and it removes an
 * entire class of merge-conflict bugs.
 */
const cartSchema = new Schema<ICart>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    lines: {
      type: [cartLineSchema],
      default: [],
      validate: {
        validator: (lines: unknown[]) => lines.length <= MAX_CART_LINES,
        message: `Un carrito no puede tener más de ${MAX_CART_LINES} líneas.`,
      },
    },
    // Optional here, required on the order: checkout refuses with 400 until
    // the customer has set one, rather than the schema enforcing it on a
    // document that legitimately starts life without it.
    shippingAddress: { type: shippingAddressSchema },
  },
  { timestamps: true },
);

// Housekeeping only. Mongo refreshes the countdown whenever `updatedAt` moves,
// so an active cart is never dropped from under a customer.
cartSchema.index({ updatedAt: 1 }, { expireAfterSeconds: CART_TTL_DAYS * 24 * 60 * 60 });

export const Cart = model<ICart>("Cart", cartSchema);
