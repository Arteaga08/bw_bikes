import type { BillingInfo } from "@bw-bikes/shared";
import { CFDI_USES, TAX_REGIMES } from "@bw-bikes/shared";
import { Schema } from "mongoose";

export const MAX_RFC_LENGTH = 13;
export const MAX_LEGAL_NAME_LENGTH = 150;
export const BILLING_POSTAL_CODE_LENGTH = 5;

/**
 * Optional CFDI data, captured by the customer on the cart
 * (`Cart.billingInfo`) and copied onto the order as a snapshot at checkout
 * (`Order.billingInfo`), the exact same pattern as `shippingAddressSchema` —
 * except every field, and the sub-document itself, stays optional end to
 * end. Nothing here is timbrado (design-spec open decision #3); it is only
 * captured so a future invoicing milestone never has to backfill orders
 * placed before it existed.
 *
 * `_id: false`: same reasoning as `shippingAddressSchema` — this is a
 * property of its parent document, not an addressable sub-resource.
 */
export const billingInfoSchema = new Schema<BillingInfo>(
  {
    rfc: { type: String, required: true, trim: true, uppercase: true, maxlength: MAX_RFC_LENGTH },
    legalName: { type: String, required: true, trim: true, maxlength: MAX_LEGAL_NAME_LENGTH },
    cfdiUse: { type: String, enum: [...CFDI_USES], required: true },
    taxRegime: { type: String, enum: [...TAX_REGIMES], required: true },
    postalCode: { type: String, required: true, trim: true, maxlength: BILLING_POSTAL_CODE_LENGTH },
  },
  { _id: false },
);
