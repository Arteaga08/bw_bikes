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
 * One schema engine, instantiated twice (`BikeSizeTemplate`, `AccessorySizeTemplate`)
 * — same split as `category.model.ts`'s `BikeCategory`/`AccessoryCategory`. "M"
 * means something different on a bike (frame size) than on a jersey accessory
 * (garment size), so the two catalogs each keep their own memory: two
 * collections, two `value` uniqueness scopes, two `MAX_SIZE_TEMPLATES` caps.
 * Feeds `SizePicker`'s chips on the "Tallas y variantes" step so "54"/"M"/"38 EU"
 * don't get retyped on every product.
 */
function buildSizeTemplateSchema(): Schema<ISizeTemplate> {
  const schema = new Schema<ISizeTemplate>(
    {
      value: { type: String, required: true, trim: true, unique: true, maxlength: MAX_SIZE_LENGTH },
      source: { type: String, enum: ["manual", "auto"] satisfies SizeTemplateSource[], required: true },
      order: { type: Number, default: 0, min: 0 },
      isActive: { type: Boolean, default: true },
    },
    { timestamps: true },
  );

  schema.index({ order: 1, value: 1 });

  return schema;
}

function createSizeTemplateModel(modelName: string) {
  return model<ISizeTemplate>(modelName, buildSizeTemplateSchema());
}

export const BikeSizeTemplate = createSizeTemplateModel("BikeSizeTemplate");
export const AccessorySizeTemplate = createSizeTemplateModel("AccessorySizeTemplate");

/** The two size-template models share an interface, so the service can be written once against this type. */
export type SizeTemplateModel = typeof BikeSizeTemplate;
