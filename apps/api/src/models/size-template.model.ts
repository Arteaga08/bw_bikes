import { type Document, model, Schema } from "mongoose";
import { MAX_SIZE_LENGTH } from "./schemas/product-variant.schema.js";

export const MAX_SIZE_TEMPLATES = 60;

export type SizeTemplateSource = "manual" | "auto";

export interface ISizeTemplate extends Document {
  /** The size itself ("54", "M", "38 EU") — free text, same as `ProductVariant.size`, not an enum: bikes and accessories don't share a sizing system. */
  value: string;
  /** `manual`: an admin created it explicitly via the CRUD. `auto`: learned the first time a variant saved this size. Never downgraded once `manual`. */
  source: SizeTemplateSource;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A saved size an admin can offer again on the next product — mirrors
 * `SpecTemplate`'s exact reasoning, one level simpler: a spec template
 * remembers a group's *shape* (title + labels), this remembers a single
 * value. Feeds `SizePicker`'s chips on the "Tallas y variantes" step so
 * "54"/"M"/"38 EU" don't get retyped on every product.
 *
 * Global, not per-catalog: same call as `SpecTemplate` — "M" means the same
 * thing on a bike and on a jersey accessory, so one shared memory.
 */
const sizeTemplateSchema = new Schema<ISizeTemplate>(
  {
    value: { type: String, required: true, trim: true, unique: true, maxlength: MAX_SIZE_LENGTH },
    source: { type: String, enum: ["manual", "auto"] satisfies SizeTemplateSource[], required: true },
    order: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

sizeTemplateSchema.index({ order: 1, value: 1 });

export const SizeTemplate = model<ISizeTemplate>("SizeTemplate", sizeTemplateSchema);
