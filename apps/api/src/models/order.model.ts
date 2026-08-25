import type {
  BillingInfo,
  CaptureMethod,
  CURRENCY,
  DisputeStatus,
  OrderLineSnapshot,
  OrderPriority,
  OrderStatus,
  PaymentProviderName,
  PaymentState,
  ShippingAddress,
} from "@bw-bikes/shared";
import { type Document, model, Schema, type Types } from "mongoose";
import { billingInfoSchema } from "./schemas/billing-info.schema.js";
import { type IOrderInternalNote, internalNoteSchema, MAX_INTERNAL_NOTES } from "./schemas/internal-note.schema.js";
import { MAX_PRICE_CENTS } from "./schemas/product-variant.schema.js";
import { MAX_ORDER_LINES, orderLineSchema } from "./schemas/order-line.schema.js";
import { type IOrderShipment, shipmentSchema } from "./schemas/shipment.schema.js";
import { shippingAddressSchema } from "./schemas/shipping-address.schema.js";

export const MAX_CANCEL_REASON_LENGTH = 300;

/** Enough history for any real order; a document that grows unbounded is a denial of service on itself. */
export const MAX_STATUS_HISTORY = 60;

/** Triage only — never validated by `order-state.ts`, never gates a transition. */
export const ORDER_PRIORITIES = ["normal", "alta", "urgente"] as const satisfies readonly OrderPriority[];

export interface IOrderStatusHistoryEntry {
  status: OrderStatus;
  at: Date;
  actorType: "user" | "system";
  actorId?: Types.ObjectId;
  reason?: string;
}

export interface IOrderPayment {
  provider: PaymentProviderName;
  state: PaymentState;
  captureMethod: CaptureMethod;
  /** The provider's own id. Also the key the webhook uses to find this order. */
  intentId?: string;
  authorizedAt?: Date;
  capturedAt?: Date;
  /** When the provider's hold lapses by itself (~7 days for Stripe). */
  authorizationExpiresAt?: Date;
  refundedAmountCents?: number;
  refundedAt?: Date;
  lastError?: string;
  /** Brand/last4 only, read back from the gateway once a charge exists — never enough to charge the card again. */
  card?: { brand: string; last4: string };
}

export interface IOrder extends Document {
  orderNumber: string;
  userId: Types.ObjectId;
  status: OrderStatus;
  /** Triage, independent of `status` — see `ORDER_PRIORITIES`. */
  priority: OrderPriority;
  lines: OrderLineSnapshot[];
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  currency: typeof CURRENCY;
  payment: IOrderPayment;
  shippingAddress: ShippingAddress;
  /** Present only once the order has shipped. */
  shipment?: IOrderShipment;
  /** Optional CFDI data (M7), copied from the cart at checkout — never required, unlike `shippingAddress`. */
  billingInfo?: BillingInfo;
  idempotencyKey?: string;
  statusHistory: IOrderStatusHistoryEntry[];
  /** Staff-only, append-only. Never served on a customer route. */
  internalNotes: IOrderInternalNote[];
  /** Sealed once, when the day-5 warning about the expiring authorization went out. */
  adminAlertedAt?: Date;
  disputedAt?: Date;
  /** Set once a chargeback has been opened; absent otherwise. Not cleared on a win — see `disputedAt`'s own doc. */
  disputeStatus?: DisputeStatus;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const statusHistorySchema = new Schema<IOrderStatusHistoryEntry>(
  {
    status: { type: String, required: true },
    at: { type: Date, required: true },
    actorType: { type: String, enum: ["user", "system"], required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    reason: { type: String, trim: true, maxlength: MAX_CANCEL_REASON_LENGTH },
  },
  { _id: false },
);

/**
 * Payment facts, embedded rather than a separate collection: an order has
 * exactly one payment in this shop, and splitting them would mean a
 * two-document write on every webhook for no gain.
 *
 * Note what is **not** stored: the client secret. It is handed to the browser
 * once, at checkout, and never persisted — it is a bearer credential for the
 * payment, and a database that holds it is a database that can leak it.
 */
const paymentSchema = new Schema<IOrderPayment>(
  {
    provider: { type: String, enum: ["stripe"] satisfies PaymentProviderName[], required: true, default: "stripe" },
    state: {
      type: String,
      enum: ["pending", "authorized", "captured", "failed", "canceled", "refunded"] satisfies PaymentState[],
      required: true,
      default: "pending",
    },
    captureMethod: {
      type: String,
      enum: ["automatic", "manual"] satisfies CaptureMethod[],
      required: true,
    },
    intentId: { type: String, trim: true },
    authorizedAt: { type: Date },
    capturedAt: { type: Date },
    authorizationExpiresAt: { type: Date },
    refundedAmountCents: { type: Number, min: 0, max: MAX_PRICE_CENTS },
    refundedAt: { type: Date },
    lastError: { type: String, trim: true, maxlength: 500 },
    card: {
      type: new Schema(
        { brand: { type: String, trim: true, maxlength: 30 }, last4: { type: String, trim: true, match: /^\d{4}$/ } },
        { _id: false },
      ),
    },
  },
  { _id: false },
);

/**
 * The transactional heart of the shop.
 *
 * ## What makes this document trustworthy
 *
 * 1. **The lines are a snapshot.** See `order-line.schema.ts`. Once written,
 *    an order never consults the catalog again.
 * 2. **`status` only moves through `order-state.ts`.** No code writes it
 *    directly; every change is validated against the transition table and
 *    appends to `statusHistory`.
 * 3. **`totalCents` is what the provider was asked to charge**, computed
 *    server-side in `order-pricing.ts` from catalog prices. No request payload
 *    contributes an amount.
 * 4. **`payment.state` is only ever advanced by the webhook** (or by the
 *    reconciliation job asking the provider the same question). A browser
 *    redirect has no authority over it — the customer closing the tab must not
 *    change whether they were charged.
 */
const orderSchema = new Schema<IOrder>(
  {
    // Human-readable and safe to say out loud on the phone. Generated with
    // randomness rather than a shared counter: a counter document is a hot spot
    // under concurrent checkouts and leaks the shop's total sales volume to
    // anyone who places two orders.
    orderNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    status: { type: String, required: true, default: "pending_payment" },

    // Never read by `order-state.ts` or any transition — a purely operational
    // sort key the admin panel changes independent of where the order is in
    // its lifecycle.
    priority: { type: String, enum: ORDER_PRIORITIES, default: "normal" },

    lines: {
      type: [orderLineSchema],
      required: true,
      validate: [
        {
          validator: (lines: unknown[]) => lines.length > 0,
          message: "Una orden no puede quedar sin líneas.",
        },
        {
          validator: (lines: unknown[]) => lines.length <= MAX_ORDER_LINES,
          message: `Una orden no puede tener más de ${MAX_ORDER_LINES} líneas.`,
        },
      ],
    },

    // Integer cents throughout. `taxCents` is a breakdown of `totalCents`, not
    // an addition to it — catalog prices already include IVA.
    subtotalCents: { type: Number, required: true, min: 0 },
    taxCents: { type: Number, required: true, min: 0 },
    shippingCents: { type: Number, required: true, min: 0, default: 0 },
    totalCents: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "MXN" },

    payment: { type: paymentSchema, required: true },

    // Copied from the cart at checkout, same snapshot reasoning as `lines`: an
    // address the customer edits afterward must not silently redirect an order
    // already placed. Checkout itself takes no body (see `createOrderSchema`),
    // so this is where that guarantee actually gets enforced — `createFromCart`
    // reads it off the cart and refuses with 400 if it is missing.
    shippingAddress: { type: shippingAddressSchema, required: true },

    // Optional CFDI data (M7, design-spec open decision #3, captured but not
    // timbrado): copied from the cart at checkout exactly like
    // `shippingAddress`, except it stays optional — an order is valid with
    // none of it.
    billingInfo: { type: billingInfoSchema },

    // Absent until the order ships; captured by `recordShipment` alongside the
    // `processing → shipped` transition, corrected afterward without touching
    // `status`.
    shipment: { type: shipmentSchema },

    // Set by the client on the checkout request so a double click or a network
    // retry resolves to the same order instead of two. Unique **per user**
    // (see the index below), never globally: two customers picking the same
    // key must not collide.
    idempotencyKey: { type: String, trim: true, maxlength: 120 },

    statusHistory: {
      type: [statusHistorySchema],
      default: [],
      validate: {
        validator: (entries: unknown[]) => entries.length <= MAX_STATUS_HISTORY,
        message: "El historial de estatus de la orden excedió su límite.",
      },
    },

    // Staff-only, append-only — see `internal-note.schema.ts`. Never mapped
    // onto `PublicOrder`.
    internalNotes: {
      type: [internalNoteSchema],
      default: [],
      validate: {
        validator: (entries: unknown[]) => entries.length <= MAX_INTERNAL_NOTES,
        message: `Una orden no puede tener más de ${MAX_INTERNAL_NOTES} notas internas.`,
      },
    },

    adminAlertedAt: { type: Date },
    disputedAt: { type: Date },
    disputeStatus: { type: String, enum: ["open", "won", "lost", "withdrawn"] },
    cancelReason: { type: String, trim: true, maxlength: MAX_CANCEL_REASON_LENGTH },
  },
  { timestamps: true },
);

// The customer's own order list, newest first.
orderSchema.index({ userId: 1, createdAt: -1 });

// Idempotent checkout, scoped per customer.
//
// `partialFilterExpression` and **not** `sparse`: a compound sparse index
// covers a document when *any* of its fields exists, and `userId` always does.
// So a sparse version would index every keyless order as `{ userId, null }`
// and a customer placing a second order without a key would collide with their
// own first one. The partial filter indexes only documents that actually carry
// a key, which is what "unique per customer, when present" really means.
orderSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } },
);

// The webhook's only lookup: from a provider payment id to the order it belongs
// to. Unique so one payment can never be claimed by two orders — the single
// index that makes `findByIntentId` a safe basis for moving money. Partial for
// the same reason as above: an order is created before its payment exists, so
// most rows briefly have no id at all.
orderSchema.index(
  { "payment.intentId": 1 },
  { unique: true, partialFilterExpression: { "payment.intentId": { $type: "string" } } },
);

// The authorization-expiry sweep: orders waiting on the supplier, ordered by
// how close their hold is to lapsing.
orderSchema.index({ status: 1, "payment.authorizationExpiresAt": 1 });

// The reconciliation sweep: orders stuck unresolved since before a cutoff.
orderSchema.index({ status: 1, createdAt: 1 });

// The "Todas" tab sorted/filtered by triage — priority first, then the
// existing status/createdAt shape so an urgent order never gets buried under
// a page of `normal` ones ahead of it.
orderSchema.index({ priority: 1, status: 1, createdAt: -1 });

// Stats windows (`services/stats/orders.stats.ts`): every daily/status/
// revenue aggregate for Inicio and Analítica filters by `createdAt` alone,
// with no leading `status`/`priority` prefix that an existing compound
// index could serve — without this, each one is a full collection scan.
// Verified with `.explain("executionStats")`: the planner picks this index
// (`IXSCAN` on `createdAt_-1`) for the exact aggregation `orders.stats.ts`
// runs, where it previously had no choice but `COLLSCAN`.
orderSchema.index({ createdAt: -1 });

// A `{ "payment.authorizedAt": 1, status: 1 }` index was tried here for
// the expiring-authorization alert (`services/stats/alerts.stats.ts`),
// which matches `payment.authorizedAt` — a different field from the sweep
// index above (`payment.authorizationExpiresAt`). Removed after
// `.explain()` showed the query planner never chose it: `status: { $in:
// [...] }` on a small, inherently transient set of orders ("authorized",
// "awaiting_supplier_confirmation") is selective enough on its own that
// the planner prefers the sweep index's `status` prefix and fetches the
// handful of matches, rather than seeking a second index. An index that
// never gets picked is pure write overhead on this collection's every
// insert/update — not kept on the strength of the theory alone.

export const Order = model<IOrder>("Order", orderSchema);
