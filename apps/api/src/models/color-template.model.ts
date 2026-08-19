import { type Document, model, Schema } from "mongoose";
import { MAX_COLOR_LENGTH } from "./schemas/product-variant.schema.js";

export const MAX_COLOR_TEMPLATES = 60;

/** `#RRGGBB`, case-insensitive on the letters — matches what a native `<input type="text">` swatch preview can render directly as CSS `background-color`. */
export const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export type ColorTemplateSource = "manual" | "auto";

export interface IColorTemplate extends Document {
  /** The color name ("Negro mate") — free text, same as `ProductVariant.color`, matched case-insensitively, not an enum. */
  value: string;
  /** `null` for an entry `learnColorTemplates` auto-created from a variant that was never typed through the admin CRUD — an admin fills this in later on `/admin/catalogo/colores`. Required for `source: "manual"`, enforced at the validator, not here. */
  hex: string | null;
  /** `manual`: an admin created/edited it explicitly. `auto`: learned the first time a variant saved this color. Never downgraded once `manual`. */
  source: ColorTemplateSource;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * One collection shared by both catalogs — unlike `SizeTemplate`'s
 * bike/accessory split, a color name means the same thing on a bike as on a
 * helmet ("Negro mate" isn't ambiguous the way "M" is between a frame and a
 * jersey), so one admin-curated palette is reused everywhere. Mirrors
 * `brand.model.ts`'s "one collection, no per-catalog split" shape.
 */
const colorTemplateSchema = new Schema<IColorTemplate>(
  {
    value: { type: String, required: true, trim: true, unique: true, maxlength: MAX_COLOR_LENGTH },
    hex: { type: String, default: null, match: HEX_PATTERN },
    source: { type: String, enum: ["manual", "auto"] satisfies ColorTemplateSource[], required: true },
    order: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

colorTemplateSchema.index({ order: 1, value: 1 });

export const ColorTemplate = model<IColorTemplate>("ColorTemplate", colorTemplateSchema);
