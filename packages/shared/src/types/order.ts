import type { AuditAction } from "./auth.js";
import type { BillingInfo } from "./billing.js";
import type { CURRENCY, FulfillmentMode, ItemType, PriceCents } from "./catalog.js";
import type { AppliedCoupon } from "./coupon.js";
import type { ShipmentSummary, ShippingAddress } from "./shipping.js";

/**
 * Explicit, single lifecycle enum for an Order. Every transition is verified
 * server-side (apps/api/src/services/order-state.ts) — never inferred from
 * other fields, never skipped.
 *
 *   pending_payment ──► authorized ──► awaiting_supplier_confirmation ──► paid ──► processing ──► shipped ──► delivered
 *          │                                    │
 *          │ (all lines in_stock, captured immediately)
 *          └────────────────────────────────────┴──► paid ──► processing ──► shipped ──► delivered
 *
 *   authorized / awaiting_supplier_confirmation ──► cancelled (admin rejects, or authorization expires)
 *   paid ──► refunded (post-payment refund/dispute resolution)
 */
export type OrderStatus =
  | "pending_payment"
  | "authorized"
  | "awaiting_supplier_confirmation"
  | "authorization_expired"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

/**
 * Operational triage, independent of `OrderStatus` — an order can be
 * `awaiting_supplier_confirmation` and `urgente` at the same time. Never
 * drives a state transition and never gates what an admin action is allowed
 * to do; it only changes where an order sorts in the queue.
 */
export type OrderPriority = "normal" | "alta" | "urgente";

/**
 * How the payment provider is told to take the money.
 *
 * `automatic` charges the card the moment it is authorized. `manual` only
 * *authorizes* — the funds are held on the customer's card but nothing is
 * captured until the shop confirms it can actually fulfil the order.
 *
 * **The mixed-cart rule**: if *any* line is not `in_stock`, the whole order
 * uses `manual`. Splitting one purchase into two payments (one captured now
 * for the helmet, one authorized for the bike) would double the customer's
 * checkout, double the refund surface, and make a partial failure
 * unexplainable. One cart is one payment.
 */
export type CaptureMethod = "automatic" | "manual";

/**
 * Payment lifecycle as **this domain** understands it, not as any one provider
 * names it. The Stripe adapter maps its own statuses onto these; a future
 * Mercado Pago adapter maps its own. Business code never sees a provider's
 * vocabulary — that is the entire point of the adapter boundary.
 *
 * `authorized` is the state that only exists with manual capture: money is
 * held, nothing has been taken.
 */
export type PaymentState =
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "canceled"
  | "refunded";

/** Which gateway processed the payment. One today, behind an adapter for the second. */
export type PaymentProviderName = "stripe";

/**
 * How an open chargeback resolved, in **this domain's** vocabulary — not
 * Stripe's `needs_response`/`under_review`/`won`/`lost`/`warning_closed`. The
 * Stripe adapter is the only place that vocabulary is read; everything past
 * it sees `open` (still contested), `won`/`withdrawn` (money stays with the
 * shop), or `lost` (money left for good, without a `refunded` order status —
 * a dispute is not a refund).
 */
export type DisputeStatus = "open" | "won" | "lost" | "withdrawn";

/**
 * One purchased line, frozen at checkout.
 *
 * This is a **snapshot, not a reference**: name, brand, size, colour and price
 * are copied out of the catalog at the moment of purchase and never read again.
 * A price change, a rename, or an archived product must not retroactively
 * alter what a customer already bought — and an order from two years ago has
 * to render correctly even if the product is long gone.
 *
 * `itemId`/`sku` are kept anyway, but only to link back to inventory and for
 * reporting — never to re-resolve display data.
 */
export interface OrderLineSnapshot {
  itemType: ItemType;
  itemId: string;
  sku: string;
  name: string;
  brand: string;
  size?: string;
  color?: string;
  /** Cloudinary id of the primary image, so order history renders without touching the catalog. */
  imagePublicId?: string;
  /** Frozen too: it decided this order's capture method and must stay auditable. */
  fulfillmentMode: FulfillmentMode;
  unitPriceCents: PriceCents;
  qty: number;
  lineTotalCents: PriceCents;
}

/**
 * Money on an order, all integer cents.
 *
 * **Catalog prices already include IVA** (standard Mexican B2C practice), so
 * `taxCents` is a *breakdown of* `totalCents`, not an addition to it:
 * `taxCents = round(total × 16 / 116)`. The identity that always holds is
 * `totalCents === subtotalCents - discountCents + shippingCents` — and
 * `totalCents` is exactly what the payment provider is asked to charge.
 * Storing the split now means invoicing (open decision #3) does not have to
 * recompute history later.
 */
export interface OrderTotals {
  subtotalCents: PriceCents;
  /**
   * Coupon discount, subtracted from the subtotal (M18). Always `0` on an
   * order placed without one.
   *
   * It is applied **before** `taxCents` is derived, and that ordering is not
   * cosmetic: because the tax is extracted from the total rather than added to
   * it, discounting afterwards would report IVA on money the customer never
   * paid.
   */
  discountCents: PriceCents;
  /** Informational: the IVA already contained in the amounts above. */
  taxCents: PriceCents;
  /**
   * Free once the order's subtotal reaches `FREE_SHIPPING_THRESHOLD_CENTS`,
   * a flat `SHIPPING_ACCESSORY_FLAT_CENTS` otherwise (see `shipping.service.ts`).
   * A bike alone already clears the threshold — there is no separate rule for
   * bikes, the arithmetic just always lands on free for them.
   */
  shippingCents: PriceCents;
  totalCents: PriceCents;
  currency: typeof CURRENCY;
}

/** Payment facts safe to show the customer who owns the order. */
export interface PaymentSummary {
  provider: PaymentProviderName;
  state: PaymentState;
  captureMethod: CaptureMethod;
  authorizedAt?: string;
  capturedAt?: string;
  /**
   * When the provider's hold lapses on its own (~7 days for Stripe). The
   * expiry job acts well before this; it is exposed so the customer and the
   * admin can both see the clock.
   */
  authorizationExpiresAt?: string;
  /**
   * Present once the gateway has a charge to report it from — never before
   * capture. Brand/last4 only; nothing here is enough to charge the card
   * again (PCI SAQ-A, same boundary as the rest of this module).
   */
  card?: { brand: string; last4: string };
}

/** One recorded step of the order's life. Append-only, never rewritten. */
export interface OrderStatusHistoryEntry {
  status: OrderStatus;
  at: string;
  actorType: "user" | "system";
  reason?: string;
}

/**
 * The same entry, with the acting admin's id. Only ever served on the admin
 * route — a customer has no business knowing which employee touched their
 * order, but the admin panel needs to say *who* moved it.
 */
export interface AdminOrderStatusHistoryEntry extends OrderStatusHistoryEntry {
  actorId?: string;
}

/** The shape the storefront receives for an order it owns. */
export interface PublicOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  priority: OrderPriority;
  lines: OrderLineSnapshot[];
  totals: OrderTotals;
  payment: PaymentSummary;
  shippingAddress: ShippingAddress;
  /** Present only once the order has shipped. */
  shipment?: ShipmentSummary;
  /** Optional CFDI data, captured on the cart and frozen here (M7) — not billed against, just kept for a future invoicing milestone. */
  billingInfo?: BillingInfo;
  /**
   * The coupon that was applied at checkout, frozen (M18). Absent on orders
   * placed without one, and never re-evaluated afterwards: a campaign that
   * later expires must not change what a customer already paid.
   */
  coupon?: AppliedCoupon;
  statusHistory: OrderStatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

/**
 * One admin-authored note, append-only like `statusHistory`. Never served on
 * a customer route — this is staff-to-staff context ("cliente llamó molesto
 * por retraso"), not something the person it's about should read.
 */
export interface OrderInternalNote {
  body: string;
  /** Absent only if the authoring account was later deleted. */
  authorId?: string;
  authorName: string;
  createdAt: string;
}

/**
 * One audit-trail entry, read back for the admin's benefit — `before`/`after`
 * are deliberately not included (they're `Mixed` and can carry PII like a
 * full address); this answers "who did what, when", not "what exactly
 * changed".
 */
export interface OrderActivityEntry {
  action: AuditAction;
  actorType: "user" | "system";
  actorId?: string;
  createdAt: string;
}

/**
 * What the admin panel additionally sees: who bought it and the provider's own
 * identifier, so an operator can cross-reference the payment in the Stripe
 * dashboard. Never served on a customer route.
 */
export interface AdminOrder extends Omit<PublicOrder, "statusHistory"> {
  customer: { id: string; email: string; firstName: string; lastName: string } | null;
  paymentIntentId?: string;
  disputedAt?: string;
  /** Present once a chargeback has been opened on this order; absent otherwise. */
  disputeStatus?: DisputeStatus;
  adminAlertedAt?: string;
  cancelReason?: string;
  statusHistory: AdminOrderStatusHistoryEntry[];
  internalNotes: OrderInternalNote[];
}

/**
 * `/admin/orders/summary` — deliberately **not** windowed by date, unlike
 * `/admin/stats/orders`: an order stuck waiting on the supplier doesn't stop
 * being stuck because the admin looked at "last 30 days". Same reasoning as
 * `OperationalAlerts` in `stats.ts`.
 */
export interface AdminOrdersSummary {
  countsByStatus: Record<OrderStatus, number>;
  /**
   * Orders whose chargeback is still unresolved (`disputeStatus: "open"`) or
   * resolved against the shop (`"lost"`) — regardless of current `status`.
   * `"won"`/`"withdrawn"` are excluded: money stayed with the shop, so they no
   * longer belong in a "problems" count even though `disputedAt` still records
   * that a dispute happened.
   */
  disputed: number;
  /** Authorizations past the alert threshold, not yet swept — same clock the background job acts on. */
  expiringAuthorizations: number;
}

/**
 * The checkout response. `clientSecret` is what the browser hands to the
 * provider's embedded widget; the API never sees a card number (PCI SAQ-A).
 *
 * Note what is *not* here: any notion of "paid". The redirect the customer
 * lands on after paying carries no authority — only the webhook moves an order
 * forward.
 */
export interface CheckoutResult {
  order: PublicOrder;
  clientSecret: string;
}
