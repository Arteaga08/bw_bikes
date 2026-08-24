import type { ItemType, ReservationReferenceType, ReservationStatus } from "@bw-bikes/shared";
import { type Document, model, Schema, type Types } from "mongoose";
import { MAX_SKU_LENGTH } from "./schemas/product-variant.schema.js";

/** A sanity ceiling for one reservation line — the cart enforces the real limit in M5. */
export const MAX_RESERVATION_QTY = 100;

/**
 * Units of one SKU held for an in-flight checkout, with an expiry.
 *
 * Only `in_stock` lines produce a document here: `on_request` and `preorder`
 * hold no physical units by definition, so a row for them would be a record
 * that claims to reserve stock while reserving nothing. Their state lives on
 * the order (M5's `awaiting_supplier_confirmation`).
 *
 * ## `status` is the mutex
 *
 * Every terminal transition is an atomic claim on this field
 * (`findOneAndUpdate({ _id, status: "held" }, ...)`), and the inventory
 * counter is only touched by whoever won that claim. That is what makes
 * `release`/`commit` idempotent, what lets the expiry job and the normal
 * checkout flow race safely over the same reservation, and what allows the API
 * to run on more than one instance without a distributed lock.
 *
 * ## Why the TTL index is on `purgeAt` and not on `expiresAt`
 *
 * A TTL on `expiresAt` would **delete an expired hold without giving the units
 * back**, stranding `reserved` at an inflated value forever — the deletion
 * removes the only record of how much to return. So:
 *
 * - `expiresAt` is a *deadline*, read by the expiry job. Nothing deletes on it.
 * - `purgeAt` carries the TTL and is written **only** when the reservation
 *   reaches `released`/`committed`. The TTL is record retention, not stock
 *   release.
 *
 * A `held` document therefore never disappears on its own. If the job stops
 * running, stock stays held for too long — conservative and visible — instead
 * of leaking silently.
 */
export interface IStockReservation extends Document {
  itemType: ItemType;
  itemId: Types.ObjectId;
  sku: string;
  qty: number;
  referenceType: ReservationReferenceType;
  referenceId: Types.ObjectId;
  userId?: Types.ObjectId;
  status: ReservationStatus;
  expiresAt: Date;
  releasedAt?: Date;
  committedAt?: Date;
  purgeAt?: Date;
  createdAt: Date;
}

const stockReservationSchema = new Schema<IStockReservation>(
  {
    itemType: {
      type: String,
      enum: ["bike", "accessory"] satisfies ItemType[],
      required: true,
    },
    itemId: { type: Schema.Types.ObjectId, required: true },
    sku: { type: String, required: true, trim: true, uppercase: true, maxlength: MAX_SKU_LENGTH },
    qty: { type: Number, required: true, min: 1, max: MAX_RESERVATION_QTY },
    referenceType: {
      type: String,
      enum: ["cart", "order"] satisfies ReservationReferenceType[],
      required: true,
    },
    referenceId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["held", "committed", "released"] satisfies ReservationStatus[],
      required: true,
      default: "held",
    },
    expiresAt: { type: Date, required: true },
    releasedAt: { type: Date },
    committedAt: { type: Date },
    // TTL: Mongo removes the document once this date is reached (`expires: 0`
    // → exactly at the stored value). Only ever set on a terminal transition —
    // see the class comment for why this is not `expiresAt`.
    purgeAt: { type: Date, expires: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// The expiry job's only query: held reservations past their deadline.
stockReservationSchema.index({ status: 1, expiresAt: 1 });

// Release/commit of everything a cart or order holds, in one lookup.
stockReservationSchema.index({ referenceType: 1, referenceId: 1 });

// The committed-units stats window (`services/stats/inventory.stats.ts`)
// matches `status: "committed"` plus `committedAt` — a different field from
// the expiry job's `expiresAt` index above, so it needs its own.
stockReservationSchema.index({ status: 1, committedAt: 1 });

export const StockReservation = model<IStockReservation>("StockReservation", stockReservationSchema);
