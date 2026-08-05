import type { Carrier } from "@bw-bikes/shared";
import { Schema } from "mongoose";

export const CARRIERS = [
  "dhl",
  "fedex",
  "estafeta",
  "paquetexpress",
  "redpack",
  "ups",
  "otro",
] as const satisfies readonly Carrier[];

export const MAX_CARRIER_NAME_LENGTH = 80;
export const MAX_TRACKING_NUMBER_LENGTH = 60;

/**
 * Tracking facts, Mongoose-side. Distinct from the shared `ShipmentSummary`
 * DTO (which carries `shippedAt` as an ISO string) because this one has a
 * `Date` field — same reasoning as `IOrderPayment` vs `PaymentSummary`.
 */
export interface IOrderShipment {
  carrier: Carrier;
  carrierName?: string;
  trackingNumber: string;
  trackingUrl: string;
  shippedAt: Date;
}

/**
 * Present only once an order has shipped. Set the first time alongside the
 * `processing → shipped` transition (see `order.service.ts#recordShipment`),
 * corrected in place afterward without touching `status` — nobody "reships" a
 * package because a tracking number was mistyped.
 *
 * `_id: false`: a property of the order, not an addressable sub-resource.
 */
export const shipmentSchema = new Schema<IOrderShipment>(
  {
    carrier: { type: String, enum: CARRIERS, required: true },
    carrierName: { type: String, trim: true, maxlength: MAX_CARRIER_NAME_LENGTH },
    trackingNumber: { type: String, required: true, trim: true, maxlength: MAX_TRACKING_NUMBER_LENGTH },
    trackingUrl: { type: String, required: true, trim: true },
    shippedAt: { type: Date, required: true },
  },
  { _id: false },
);
