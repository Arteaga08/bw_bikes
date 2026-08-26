import type { CouponScope, CouponScopeKind, CouponType, ItemType } from "@bw-bikes/shared";
import { type Document, model, Schema } from "mongoose";

export const MAX_COUPON_CODE_LENGTH = 24;
export const MAX_COUPON_NAME_LENGTH = 80;

/** 100% off. A coupon may not go past it, and the checkout still enforces a minimum chargeable total. */
export const MAX_PERCENT_OFF_BPS = 10_000;

/**
 * A coupon may not take the payable total below this.
 *
 * Stripe rejects a MXN charge under $10, so a discount that lands beneath it
 * would not produce a cheap order — it would produce a checkout that fails at
 * the gateway with a message nobody can act on. `coupon.service.ts` refuses the
 * coupon up front instead, in Spanish, while the customer can still remove it.
 */
export const MIN_CHARGEABLE_CENTS = 1_000;

const COUPON_TYPES = ["percent_off", "amount_off"] as const satisfies readonly CouponType[];
const COUPON_SCOPE_KINDS = [
  "all",
  "bikes",
  "accessories",
  "categories",
] as const satisfies readonly CouponScopeKind[];
const ITEM_TYPES = ["bike", "accessory"] as const satisfies readonly ItemType[];

/** Uppercase letters, digits and hyphens. Nothing that needs escaping in a URL, an email or a regex. */
export const COUPON_CODE_PATTERN = /^[A-Z0-9-]+$/;

export interface ICoupon extends Document {
  code: string;
  name: string;
  type: CouponType;
  percentOffBps?: number;
  amountOffCents?: number;
  maxDiscountCents?: number;
  minSubtotalCents?: number;
  scope: CouponScope;
  startsAt?: Date;
  expiresAt?: Date;
  maxRedemptionsTotal?: number;
  maxRedemptionsPerCustomer: number;
  redemptionCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Which slice of the cart the discount may touch.
 *
 * `categoryIds` needs `itemType` beside it because bikes and accessories have
 * two **independent** category trees (`BikeCategory` / `AccessoryCategory`,
 * see `category.model.ts`) — an id alone doesn't say which collection to read,
 * and a bike category id resolved against accessories would silently match
 * nothing and hand the customer a zero discount with no explanation.
 */
const couponScopeSchema = new Schema<CouponScope>(
  {
    kind: { type: String, enum: COUPON_SCOPE_KINDS, required: true, default: "all" },
    categoryIds: { type: [String], default: undefined },
    itemType: { type: String, enum: ITEM_TYPES },
  },
  { _id: false },
);

/**
 * A discount campaign, redeemed by code at checkout.
 *
 * **The code is shared, not secret.** Anyone who learns `BUENFIN20` can try
 * it, and that is by design — the safety comes from the two limits, not from
 * the code being hard to guess. `maxRedemptionsTotal` bounds the campaign's
 * cost; `maxRedemptionsPerCustomer` stops one person from draining it. Both
 * are enforced against the `CouponRedemption` ledger.
 *
 * `redemptionCount` is a denormalised counter, incremented atomically so two
 * simultaneous checkouts can't both slip past the last available redemption.
 * It is a fast guard, not the truth — the ledger is, and the ledger's unique
 * `{couponId, orderId}` index is what makes a redemption idempotent when a
 * checkout is replayed.
 *
 * Exactly one of `percentOffBps` / `amountOffCents` is ever set. That
 * invariant lives in `pre("validate")` below *and* in the Joi validator: the
 * validator catches the admin's typo with a good message, the hook catches
 * every other writer (scripts, campaign generation, a future import).
 */
const couponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: MAX_COUPON_CODE_LENGTH,
      match: COUPON_CODE_PATTERN,
    },
    // The admin's label for the campaign, never shown to the customer.
    name: { type: String, required: true, trim: true, maxlength: MAX_COUPON_NAME_LENGTH },
    type: { type: String, enum: COUPON_TYPES, required: true },
    // Basis points, not percent: 12.5% is expressible and no float is stored.
    percentOffBps: { type: Number, min: 1, max: MAX_PERCENT_OFF_BPS },
    amountOffCents: { type: Number, min: 1 },
    maxDiscountCents: { type: Number, min: 1 },
    minSubtotalCents: { type: Number, min: 0 },
    scope: { type: couponScopeSchema, required: true, default: () => ({ kind: "all" }) },
    startsAt: { type: Date },
    expiresAt: { type: Date },
    // Absent means uncapped. `min: 1` because a campaign nobody may redeem is
    // an inactive campaign, and `isActive: false` already says that clearly.
    maxRedemptionsTotal: { type: Number, min: 1 },
    // Field-level `default`, not just `required`: an already-persisted coupon
    // reads back `undefined` for a field that only has `required` on it, and
    // `undefined < n` is false — which would silently uncap the per-customer
    // limit rather than enforcing it. Same trap `settings.model.ts` documents.
    maxRedemptionsPerCustomer: { type: Number, required: true, min: 1, default: 1 },
    redemptionCount: { type: Number, required: true, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

couponSchema.pre("validate", function (next) {
  const hasPercent = this.percentOffBps !== undefined && this.percentOffBps !== null;
  const hasAmount = this.amountOffCents !== undefined && this.amountOffCents !== null;

  if (hasPercent === hasAmount) {
    next(new Error("Un cupón debe definir exactamente uno de percentOffBps o amountOffCents."));
    return;
  }
  if (this.type === "percent_off" && !hasPercent) {
    next(new Error("Un cupón de porcentaje requiere percentOffBps."));
    return;
  }
  if (this.type === "amount_off" && !hasAmount) {
    next(new Error("Un cupón de monto fijo requiere amountOffCents."));
    return;
  }
  // A ceiling only means anything on a percentage — on a fixed amount it would
  // be a second, contradictory way of saying the same number.
  if (this.maxDiscountCents !== undefined && this.type !== "percent_off") {
    next(new Error("maxDiscountCents solo aplica a cupones de porcentaje."));
    return;
  }
  if (this.startsAt && this.expiresAt && this.expiresAt <= this.startsAt) {
    next(new Error("La fecha de expiración debe ser posterior a la de inicio."));
    return;
  }
  if (this.scope.kind === "categories" && (!this.scope.categoryIds?.length || !this.scope.itemType)) {
    next(new Error("Un cupón limitado a categorías requiere categoryIds e itemType."));
    return;
  }

  next();
});

// The admin listing's default view ("vigentes primero") and the only filter
// that isn't served by the unique index on `code`.
couponSchema.index({ isActive: 1, expiresAt: 1 });
couponSchema.index({ createdAt: -1 });

export const Coupon = model<ICoupon>("Coupon", couponSchema);
