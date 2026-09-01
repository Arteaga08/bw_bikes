import type { SavedAddress } from "@bw-bikes/shared";
import { MEXICAN_STATES } from "@bw-bikes/shared";
import { Schema, type Types } from "mongoose";
import {
  MAX_ADDRESS_LINE_LENGTH,
  MAX_RECIPIENT_NAME_LENGTH,
  MAX_REFERENCES_LENGTH,
  PHONE_LENGTH,
  POSTAL_CODE_LENGTH,
} from "./shipping-address.schema.js";

export const MAX_LABEL_LENGTH = 30;
export const MAX_SAVED_ADDRESSES = 5;

/**
 * The Mongoose-side shape of a `User.addresses` entry: same fields as the
 * shared `SavedAddress` DTO, minus its string `id` (Mongoose keeps a real
 * `_id: Types.ObjectId` on the subdocument instead — the service converts one
 * to the other when building the DTO).
 */
export interface ISavedAddress extends Omit<SavedAddress, "id"> {
  _id: Types.ObjectId;
}

/**
 * A customer's address book entry (`User.addresses`, A3). Same fields as
 * `ShippingAddress` — reusing its constants so the two shapes can't drift
 * apart — plus `label` and `isDefault`. Unlike `shippingAddressSchema`, this
 * one keeps its `_id`: here an address is a direct sub-resource the customer
 * edits/deletes by id, not a copy embedded in a parent document.
 */
export const savedAddressSchema = new Schema<ISavedAddress>({
  label: { type: String, required: true, trim: true, maxlength: MAX_LABEL_LENGTH },
  isDefault: { type: Boolean, default: false },
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
});
