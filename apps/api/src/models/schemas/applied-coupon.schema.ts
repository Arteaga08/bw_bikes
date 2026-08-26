import type { AppliedCoupon, CouponType } from "@bw-bikes/shared";
import { Schema } from "mongoose";
import { MAX_COUPON_CODE_LENGTH } from "../coupon.model.js";

const COUPON_TYPES = ["percent_off", "amount_off"] as const satisfies readonly CouponType[];

/**
 * The coupon applied to an order, frozen at checkout (M18).
 *
 * A **snapshot**, for the same reason `orderLineSchema` is one: the campaign
 * this points at can be renamed, re-priced, expired or deactivated afterwards,
 * and none of that may retroactively change what a customer already paid.
 * `code`, `type` and `discountCents` are therefore copied rather than read
 * through `couponId` — which is kept only so reporting can link a sale back to
 * the campaign that produced it.
 *
 * `_id: false`: a property of its parent order, not an addressable
 * sub-resource. The redemption *ledger* (`CouponRedemption`) is the addressable
 * record, and it is a separate collection precisely because it answers a
 * different question — "who has used this campaign", not "what did this order
 * cost".
 */
export const appliedCouponSchema = new Schema<AppliedCoupon>(
  {
    couponId: { type: String, required: true },
    code: { type: String, required: true, uppercase: true, trim: true, maxlength: MAX_COUPON_CODE_LENGTH },
    type: { type: String, enum: COUPON_TYPES, required: true },
    discountCents: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);
