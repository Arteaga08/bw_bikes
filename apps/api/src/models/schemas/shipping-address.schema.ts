import type { ShippingAddress } from "@bw-bikes/shared";
import { MEXICAN_STATES } from "@bw-bikes/shared";
import { Schema } from "mongoose";

export const MAX_RECIPIENT_NAME_LENGTH = 120;
export const MAX_ADDRESS_LINE_LENGTH = 150;
export const MAX_REFERENCES_LENGTH = 300;
export const PHONE_LENGTH = 10;
export const POSTAL_CODE_LENGTH = 5;

/**
 * Where an order ships, captured by the customer on the cart (`Cart.shippingAddress`)
 * and copied onto the order as a snapshot at checkout (`Order.shippingAddress`,
 * required). No `Date` fields, so — unlike `payment` or the new `shipment`
 * sub-schema — this can be typed directly against the shared `ShippingAddress`
 * DTO instead of a separate Mongoose-side interface.
 *
 * `_id: false`: same reasoning as `order-line.schema.ts` — an address is a
 * property of its parent document, not an addressable sub-resource.
 */
export const shippingAddressSchema = new Schema<ShippingAddress>(
  {
    recipientName: { type: String, required: true, trim: true, maxlength: MAX_RECIPIENT_NAME_LENGTH },
    phone: { type: String, required: true, trim: true, maxlength: PHONE_LENGTH },
    street: { type: String, required: true, trim: true, maxlength: MAX_ADDRESS_LINE_LENGTH },
    interiorNumber: { type: String, trim: true, maxlength: 30 },
    neighborhood: { type: String, required: true, trim: true, maxlength: MAX_ADDRESS_LINE_LENGTH },
    city: { type: String, required: true, trim: true, maxlength: MAX_ADDRESS_LINE_LENGTH },
    state: { type: String, enum: [...MEXICAN_STATES], required: true },
    postalCode: { type: String, required: true, trim: true, maxlength: POSTAL_CODE_LENGTH },
    country: { type: String, required: true, default: "MX", enum: ["MX"] },
    references: { type: String, trim: true, maxlength: MAX_REFERENCES_LENGTH },
  },
  { _id: false },
);
