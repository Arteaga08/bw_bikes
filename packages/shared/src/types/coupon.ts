import type { ItemType, PriceCents } from "./catalog.js";

/**
 * How a coupon reduces the bill.
 *
 * Two kinds only, and they are mutually exclusive on a given coupon: a
 * percentage off, or a fixed amount off. Free shipping was considered and left
 * out — shipping is already free above a threshold (`shipping.service.ts`), so
 * a free-shipping coupon would be a no-op on most carts and a confusing
 * promise on the rest.
 */
export type CouponType = "percent_off" | "amount_off";

/**
 * Which lines of the cart a coupon is allowed to discount.
 *
 * `all` is the common case. The other three exist so a campaign can be aimed
 * at a slice of the catalog ("20% en accesorios") without the discount
 * leaking onto a six-figure bike sitting in the same cart.
 */
export type CouponScopeKind = "all" | "bikes" | "accessories" | "categories";

/**
 * The scope, as stored and as sent by the admin panel.
 *
 * `categoryIds` is only meaningful for `kind: "categories"`, and it needs
 * `itemType` alongside it: bikes and accessories have **two independent
 * category trees** (`BikeCategory` and `AccessoryCategory` in
 * `category.model.ts`), so an id on its own does not say which collection to
 * look in. Both are validated as required-together server-side.
 */
export interface CouponScope {
  kind: CouponScopeKind;
  categoryIds?: string[];
  itemType?: ItemType;
}

/**
 * A discount campaign.
 *
 * The code is shared — anyone who knows it can try to use it — and the limits
 * are what make it safe: `maxRedemptionsTotal` caps the campaign as a whole,
 * `maxRedemptionsPerCustomer` caps any single customer. Both are enforced
 * against the `CouponRedemption` ledger, never against a counter alone.
 *
 * Exactly one of `percentOffBps` / `amountOffCents` is ever set, matching
 * `type`. Basis points, not percent, for the same reason every amount here is
 * in cents: 12.5% is expressible and no float ever reaches the database.
 */
export interface AdminCoupon {
  id: string;
  /** Uppercase `A-Z0-9-`. What the customer types. */
  code: string;
  /** Internal campaign name for the admin's benefit ("Buen Fin 2026"). Never shown to the customer. */
  name: string;
  type: CouponType;
  /** Set when `type` is `percent_off`. 1000 = 10%. */
  percentOffBps?: number;
  /** Set when `type` is `amount_off`. */
  amountOffCents?: PriceCents;
  /**
   * Ceiling on a percentage discount. Without it a 20% coupon takes $40,000
   * off a $200,000 bike — which is a decision the shop should make on purpose,
   * not discover afterwards.
   */
  maxDiscountCents?: PriceCents;
  /**
   * Minimum cart subtotal to qualify. Checked against the **whole** subtotal,
   * not the scoped one: "en compras mayores a $5,000" is what the customer
   * reads, and their cart total is what they can see.
   */
  minSubtotalCents?: PriceCents;
  scope: CouponScope;
  startsAt?: string;
  expiresAt?: string;
  /** Absent means uncapped. */
  maxRedemptionsTotal?: number;
  maxRedemptionsPerCustomer: number;
  /** Denormalised counter, incremented atomically. The ledger stays the source of truth. */
  redemptionCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * A coupon as it applies to one specific cart or order.
 *
 * `discountCents` is the resolved amount for *these* lines, computed server
 * side. On a cart it is a preview that is recomputed on every render; on an
 * order it is frozen at checkout and never recalculated — which is what lets
 * `replayCheckout` reuse `order.totalCents` without re-evaluating the coupon.
 */
export interface AppliedCoupon {
  couponId: string;
  code: string;
  type: CouponType;
  discountCents: PriceCents;
}

/** One row of the redemption ledger, as the admin panel reads it back. */
export interface CouponRedemptionEntry {
  id: string;
  couponId: string;
  code: string;
  orderId: string;
  orderNumber: string;
  discountCents: PriceCents;
  createdAt: string;
}
