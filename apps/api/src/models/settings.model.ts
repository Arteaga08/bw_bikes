import type {
  ApplicationsSettings,
  InventorySettings,
  JobsSettings,
  OrdersSettings,
  PricingSettings,
  ShippingSettings,
} from "@bw-bikes/shared";
import { type Document, model, Schema } from "mongoose";
import {
  DEFAULT_LOW_STOCK_ALERT_INTERVAL_MS,
  DEFAULT_LOW_STOCK_THRESHOLD_UNITS,
  DEFAULT_REQUEST_THREE_D_SECURE,
  SETTINGS_DEFAULTS,
} from "../config/settings.defaults.js";

/**
 * The one document this collection ever holds. `key` carries a unique index
 * instead of relying on "there is only one document" as an unenforced
 * convention — a duplicate insert fails loudly at the database instead of
 * quietly producing two singletons that disagree.
 */
export const SETTINGS_SINGLETON_KEY = "global";

export interface ISettings extends Document {
  key: string;
  inventory: InventorySettings;
  orders: OrdersSettings;
  pricing: PricingSettings;
  shipping: ShippingSettings;
  applications: ApplicationsSettings;
  jobs: JobsSettings;
  createdAt: Date;
  updatedAt: Date;
}

const inventorySchema = new Schema<InventorySettings>(
  {
    stockReservationTtlMinutes: { type: Number, required: true, min: 1 },
    reservationRetentionDays: { type: Number, required: true, min: 1 },
    // Field-level default (not just the `inventory` sub-document's default
    // below) — the singleton predates this field (M7), so an existing
    // document has `inventory` set but not this path. Mongoose applies a
    // field's own default during hydration for any path missing from the
    // stored document, which is what let this self-heal on the next read
    // instead of needing a migration. Any settings field added to an
    // already-persisted singleton needs the same treatment, not just a
    // `required: true`.
    lowStockThresholdUnits: { type: Number, required: true, min: 0, default: DEFAULT_LOW_STOCK_THRESHOLD_UNITS },
  },
  { _id: false },
);

const ordersSchema = new Schema<OrdersSettings>(
  {
    orderPaymentTtlMinutes: { type: Number, required: true, min: 1 },
    orderAuthAlertHours: { type: Number, required: true, min: 1 },
    orderAuthCancelHours: { type: Number, required: true, min: 1 },
    paymentReconciliationAfterMinutes: { type: Number, required: true, min: 1 },
    // Field-level default, same reasoning as `inventory.lowStockThresholdUnits`
    // above: the singleton predates this field (M9), so an existing document
    // has `orders` set but not this path. Found missing this treatment during
    // the Sesión 3 audit — without it, `doc.orders.requestThreeDSecure` reads
    // back `undefined` on any settings singleton created before M9, despite
    // `required: true`, because Mongoose only enforces `required` on save.
    requestThreeDSecure: {
      type: String,
      required: true,
      enum: ["automatic", "any"],
      default: DEFAULT_REQUEST_THREE_D_SECURE,
    },
  },
  { _id: false },
);

const pricingSchema = new Schema<PricingSettings>(
  { taxRateBps: { type: Number, required: true, min: 0 } },
  { _id: false },
);

const shippingSchema = new Schema<ShippingSettings>(
  {
    accessoryFlatCents: { type: Number, required: true, min: 0 },
    freeShippingThresholdCents: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const applicationsSchema = new Schema<ApplicationsSettings>(
  { cooldownDays: { type: Number, required: true, min: 0 } },
  { _id: false },
);

// `min: 1`, not a stricter operational floor: the HTTP-facing Joi validator
// (`settingsJobsSchema`) is where the practical 1s floor for an admin's real
// input lives. Keeping the model permissive down to any positive integer is
// what lets tests seed the same sub-second intervals the old env-var
// fixtures used, so a job's own timer test can still observe a real tick
// without waiting out a production-scale interval.
const jobsSchema = new Schema<JobsSettings>(
  {
    reservationReaperIntervalMs: { type: Number, required: true, min: 1 },
    orderAuthSweepIntervalMs: { type: Number, required: true, min: 1 },
    paymentReconciliationIntervalMs: { type: Number, required: true, min: 1 },
    // Field-level default, same reasoning as `inventory.lowStockThresholdUnits`
    // above: this field is added to a `jobs` sub-document that may already be
    // persisted on the singleton, so an existing document self-heals on the
    // next read instead of needing a migration.
    lowStockAlertIntervalMs: {
      type: Number,
      required: true,
      min: 1,
      default: DEFAULT_LOW_STOCK_ALERT_INTERVAL_MS,
    },
  },
  { _id: false },
);

const settingsSchema = new Schema<ISettings>(
  {
    key: { type: String, required: true, unique: true, default: SETTINGS_SINGLETON_KEY },
    inventory: { type: inventorySchema, required: true, default: () => SETTINGS_DEFAULTS.inventory },
    orders: { type: ordersSchema, required: true, default: () => SETTINGS_DEFAULTS.orders },
    pricing: { type: pricingSchema, required: true, default: () => SETTINGS_DEFAULTS.pricing },
    shipping: { type: shippingSchema, required: true, default: () => SETTINGS_DEFAULTS.shipping },
    applications: { type: applicationsSchema, required: true, default: () => SETTINGS_DEFAULTS.applications },
    jobs: { type: jobsSchema, required: true, default: () => SETTINGS_DEFAULTS.jobs },
  },
  { timestamps: true },
);

/**
 * Same invariant `config/env.ts` used to enforce at boot
 * (`ORDER_AUTH_ALERT_HOURS < ORDER_AUTH_CANCEL_HOURS`): warning the admin
 * *after* the authorization was already cancelled would make the alert
 * useless. Enforced here too, not only in the validator, because once the
 * value lives in this collection HTTP is not its only writer forever (a
 * future migration script, a seed, a direct `mongosh` fix all go through
 * this same schema).
 *
 * Uses `this.invalidate(path, message)` rather than `next(new Error(...))`:
 * `invalidate` is what makes this surface as a proper
 * `mongoose.Error.ValidationError` — the shape `error-handler.ts` maps to a
 * 400. A bare `Error` passed to `next()` from a pre-validate hook rejects
 * `.save()` with that raw error instead, which the handler doesn't
 * recognize and would fall through to a 500.
 */
settingsSchema.pre("validate", function assertAuthWindowOrdering(next) {
  if (this.orders.orderAuthAlertHours >= this.orders.orderAuthCancelHours) {
    this.invalidate(
      "orders.orderAuthAlertHours",
      `orderAuthAlertHours (${this.orders.orderAuthAlertHours}) debe ser menor que orderAuthCancelHours (${this.orders.orderAuthCancelHours}).`,
    );
  }
  next();
});

export const Settings = model<ISettings>("Settings", settingsSchema);
