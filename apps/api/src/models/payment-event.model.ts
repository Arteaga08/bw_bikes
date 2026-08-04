import type { PaymentProviderName } from "@bw-bikes/shared";
import { type Document, model, Schema, type Types } from "mongoose";

/** Processing outcome of one delivered webhook event. */
export type PaymentEventStatus = "processed" | "ignored" | "failed";

/**
 * How long a handled event is kept. Long enough to investigate a payment
 * dispute weeks after the fact, short enough that the collection stays small.
 *
 * The retention window is also the **deduplication window**: once a record is
 * purged, a redelivery of that same event would be processed again. Providers
 * retry for hours, not months, so the margin here is enormous — but it is the
 * reason this is measured in days rather than minutes.
 */
export const PAYMENT_EVENT_RETENTION_DAYS = 60;

export interface IPaymentEvent extends Document {
  provider: PaymentProviderName;
  eventId: string;
  type: string;
  status: PaymentEventStatus;
  orderId?: Types.ObjectId;
  error?: string;
  purgeAt: Date;
  createdAt: Date;
}

/**
 * One row per webhook event the payment provider delivered.
 *
 * ## This collection *is* the deduplication mechanism
 *
 * Providers redeliver: on our 500, on a timeout, on their own retry schedule,
 * and sometimes simply twice. Processing `payment_intent.succeeded` twice would
 * commit the same inventory twice.
 *
 * The guard is the **unique index on `eventId`**, and the insert happens
 * *before* the event is dispatched. That ordering matters: a `findOne` check
 * followed by an insert is a read-then-write, and two simultaneous redeliveries
 * would both read "not seen" before either wrote. Letting the database reject
 * the second insert moves the race to where it can actually be resolved.
 *
 * The handlers are written to be idempotent anyway — every state change is
 * validated against the current status first — so a hypothetical failure of
 * this table still cannot move an order twice. Two independent guards, because
 * this is the one place where being wrong means charging someone twice.
 */
const paymentEventSchema = new Schema<IPaymentEvent>(
  {
    provider: { type: String, enum: ["stripe"] satisfies PaymentProviderName[], required: true, default: "stripe" },
    eventId: { type: String, required: true, unique: true, trim: true },
    type: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["processed", "ignored", "failed"] satisfies PaymentEventStatus[],
      required: true,
      default: "processed",
    },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    // Kept when a handler throws, so a failed event is diagnosable rather than
    // just absent. The event still counts as seen — a handler that fails
    // deterministically would otherwise fail forever on every redelivery.
    error: { type: String, trim: true, maxlength: 500 },
    purgeAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const PaymentEvent = model<IPaymentEvent>("PaymentEvent", paymentEventSchema);
