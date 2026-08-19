import { Schema } from "mongoose";
import { MAX_COLOR_LENGTH } from "./product-variant.schema.js";

/** A product gallery never needs more images than this, and a cap keeps the document bounded. */
export const MAX_GALLERY_IMAGES = 15;

export const MAX_IMAGE_ALT_LENGTH = 160;

/**
 * A Cloudinary asset reference. What's persisted is the `publicId` — the URL
 * is derived at delivery time via `buildImageUrl` (packages/shared), so the
 * storefront can request several widths of the same original for a responsive
 * `srcset` without re-uploading anything.
 *
 * `width`/`height` come back from Cloudinary and are stored so the storefront
 * can reserve the right aspect ratio before the image loads (avoids layout
 * shift, which Core Web Vitals penalizes in M12).
 */
export const productImageSchema = new Schema(
  {
    publicId: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    alt: { type: String, trim: true, maxlength: MAX_IMAGE_ALT_LENGTH },
    color: { type: String, trim: true, maxlength: MAX_COLOR_LENGTH },
    order: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);
