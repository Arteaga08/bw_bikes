import { Schema } from "mongoose";
import { MAX_IMAGE_ALT_LENGTH } from "./product-image.schema.js";

/**
 * A category's single image (M10.2) — same Cloudinary-backed shape as
 * `productImageSchema`, minus `order`: a category never has more than one
 * image, so there's nothing to sequence. Reuses `MAX_IMAGE_ALT_LENGTH` rather
 * than duplicating it — one cap for "how long can alt text be", regardless of
 * which document embeds it.
 */
export const categoryImageSchema = new Schema(
  {
    publicId: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    alt: { type: String, trim: true, maxlength: MAX_IMAGE_ALT_LENGTH },
  },
  { _id: false },
);
