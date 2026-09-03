import type { BillingInfo } from "./billing.js";
import type { CURRENCY, FulfillmentMode, ItemType, PriceCents } from "./catalog.js";
import type { AppliedCoupon } from "./coupon.js";
import type { CaptureMethod } from "./order.js";
import type { ShippingAddress } from "./shipping.js";

/** What the client sends to put something in the cart. Quantity is bounded server-side. */
export interface CartLineInput {
  itemType: ItemType;
  itemId: string;
  sku: string;
  qty: number;
}

/**
 * A cart line as rendered by the storefront.
 *
 * **Nothing here is binding.** `unitPriceCents` is the price *right now* and
 * `available` is the stock *right now*; both are re-read from the database at
 * checkout, and the order's own snapshot is the only figure that ever gets
 * charged. A cart is a shopping list, not a quote — which is also why adding
 * to it holds no stock (see `PublicCart`).
 */
export interface PublicCartLine {
  itemType: ItemType;
  itemId: string;
  sku: string;
  slug: string;
  name: string;
  brand: string;
  size?: string;
  color?: string;
  imagePublicId?: string;
  fulfillmentMode: FulfillmentMode;
  unitPriceCents: PriceCents;
  qty: number;
  lineTotalCents: PriceCents;
  /**
   * Units purchasable today. `null` for `on_request`/`preorder`, which own no
   * stock at all — that is not "zero available", it is "availability is not
   * the question for this line".
   */
  available: number | null;
  /** False when the line can no longer be bought (archived product, inactive variant, no stock). */
  isPurchasable: boolean;
  /** Present when `isPurchasable` is false, in Spanish, ready to render. */
  unavailableReason?: string;
}

/**
 * The customer's cart.
 *
 * **Adding to the cart reserves nothing.** Stock is held only when an order is
 * created, for a short window while the customer pays. Holding inventory from
 * the moment someone clicks "add" would let anyone empty the visible catalog
 * without spending a peso.
 *
 * `captureMethod` is a preview of what checkout will do, so the storefront can
 * warn up front that a purchase containing a made-to-order bike is authorized
 * now and charged only once the shop confirms with the supplier.
 *
 * `shippingAddress` is captured here, before checkout, and copied onto the
 * order as a snapshot when it is placed — checkout itself takes no body, so
 * this is the only place the customer supplies it. `shippingCents` previews
 * `shippingService`'s quote (see `order-pricing.ts` / M6) so the storefront
 * can show "Envío: Gratis" or a monto before the customer commits to paying.
 *
 * `billingInfo` (M7) follows the exact same pattern for the optional CFDI
 * data: captured on the cart, copied onto the order at checkout. Unlike the
 * shipping address, it is never required — an order is valid with none of it.
 *
 * `coupon` (M18) is the same pattern once more, with one difference: the cart
 * stores only the **code**, and the discount is re-evaluated on every render.
 * A coupon that expired, ran out, or stopped matching the cart's contents is
 * dropped — from this response and from the stored cart alike — rather than
 * failing it: a customer must always be able to see their cart, and must
 * never be left holding a dead code that keeps refusing checkout.
 */
export interface PublicCart {
  id: string;
  lines: PublicCartLine[];
  shippingAddress?: ShippingAddress;
  billingInfo?: BillingInfo;
  /** Present only while the stored code still resolves to a usable discount. */
  coupon?: AppliedCoupon;
  subtotalCents: PriceCents;
  /** `0` when no coupon applies. Subtracted from the subtotal before the IVA is derived. */
  discountCents: PriceCents;
  taxCents: PriceCents;
  shippingCents: PriceCents;
  totalCents: PriceCents;
  currency: typeof CURRENCY;
  captureMethod: CaptureMethod;
  /** True when at least one line cannot be purchased — checkout will refuse until it is fixed. */
  hasBlockingLines: boolean;
  updatedAt: string;
}
