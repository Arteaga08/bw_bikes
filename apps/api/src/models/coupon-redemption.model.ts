import { type Document, model, Schema, type Types } from "mongoose";
import { MAX_COUPON_CODE_LENGTH } from "./coupon.model.js";

export interface ICouponRedemption extends Document {
  couponId: Types.ObjectId;
  userId: Types.ObjectId;
  orderId: Types.ObjectId;
  /**
   * This customer's ordinal claim on the coupon: 0 for their first redemption,
   * 1 for their second, and so on. It exists purely to give
   * `maxRedemptionsPerCustomer` something to collide on — see the unique index
   * below — and carries no meaning beyond "which slot this row occupies".
   */
  slot: number;
  /** Frozen alongside the reference: a campaign can be renamed, a redemption can't. */
  code: string;
  discountCents: number;
  createdAt: Date;
}

/**
 * The redemption ledger — one row per (coupon, order).
 *
 * This exists instead of a bare counter because both limits are questions a
 * counter cannot answer: "has *this customer* already used it?" needs rows,
 * and "did this checkout already redeem?" needs a key to collide on.
 *
 * Rows are deleted, not tombstoned, when an order is cancelled before payment
 * — the customer never paid, so the campaign was never spent and the coupon
 * goes back in the pool. A refund is the opposite case and leaves the row
 * alone: that sale did happen.
 */
const couponRedemptionSchema = new Schema<ICouponRedemption>(
  {
    couponId: { type: Schema.Types.ObjectId, ref: "Coupon", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    slot: { type: Number, required: true, min: 0 },
    code: { type: String, required: true, uppercase: true, trim: true, maxlength: MAX_COUPON_CODE_LENGTH },
    discountCents: { type: Number, required: true, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

/**
 * **The idempotency guarantee.**
 *
 * `replayCheckout` re-creates a payment intent for an order that already
 * exists, and a customer retrying a flaky network can hit checkout twice with
 * the same idempotency key. Neither may spend a second redemption. This index
 * turns that from a race the service has to win into a duplicate-key error the
 * service simply swallows.
 */
couponRedemptionSchema.index({ couponId: 1, orderId: 1 }, { unique: true });

/**
 * **The per-customer limit, enforced atomically.**
 *
 * `maxRedemptionsPerCustomer` used to be checked only in `evaluate`'s
 * `countDocuments` — a read with no lock behind it. Two checkouts by the same
 * customer racing through `evaluate` both read "0 used" and both proceed,
 * which lets a one-per-customer coupon be claimed as many times as requests
 * arrive concurrently. This index is what `redeem` claims a `slot` against
 * (0, 1, 2, ... up to the cap): Mongo serializes concurrent inserts on the
 * same `{couponId, userId, slot}`, so only one claimant per slot ever wins,
 * regardless of how many arrive at once.
 */
couponRedemptionSchema.index({ couponId: 1, userId: 1, slot: 1 }, { unique: true });

// "Which coupons has this customer redeemed?" — the customer detail drawer (M22).
couponRedemptionSchema.index({ userId: 1, createdAt: -1 });

export const CouponRedemption = model<ICouponRedemption>("CouponRedemption", couponRedemptionSchema);
