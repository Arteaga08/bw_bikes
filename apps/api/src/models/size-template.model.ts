import { type Document, model, Schema, type Types } from "mongoose";
import { MAX_SIZE_LENGTH } from "./schemas/product-variant.schema.js";

export const MAX_SIZE_TEMPLATES = 60;
export const MAX_SIZE_CATEGORY_OVERRIDES = 10;
export const MIN_BODY_HEIGHT_CM = 100;
export const MAX_BODY_HEIGHT_CM = 230;

export type SizeTemplateSource = "manual" | "auto";

export interface ISizeHeightRange {
  minHeightCm: number;
  maxHeightCm: number;
}

/** A `heightRange` scoped to one bike category — takes precedence over the template's base `heightRange` for products in that category (or, failing an exact match, its parent). See `resolveHeightRange` in `size-template.service.ts`. */
export interface ISizeCategoryOverride extends ISizeHeightRange {
  categoryId: Types.ObjectId;
}

export interface ISizeTemplate extends Document {
  /** The size itself ("54", "M", "38 EU") — free text, same as `ProductVariant.size`, not an enum: bikes and accessories don't share a sizing system. */
  value: string;
  /** `manual`: an admin created it explicitly via the CRUD. `auto`: learned the first time a variant saved this size. Never downgraded once `manual`. */
  source: SizeTemplateSource;
  order: number;
  isActive: boolean;
  /**
   * Rider height this size fits, in centimeters — feeds the storefront size
   * guide (PDP "¿Cuál es mi talla?"). Optional and both-or-neither: most of
   * the existing catalog has never captured this and must keep working
   * un-annotated; a size with no range is simply left out of the guide.
   * Declared here (on the size template itself), not per-product — Manuel's
   * call, 2026-08-31: "M" means the same rider height everywhere in the
   * catalog by default, captured once, not retyped per bike.
   */
  heightRange?: ISizeHeightRange;
  /**
   * Bikes only in practice (accessories don't use the size guide), but kept
   * on the shared schema like everything else here — same reasoning as
   * `source`. Empty for a template with no per-category exceptions.
   */
  categoryOverrides: ISizeCategoryOverride[];
  createdAt: Date;
  updatedAt: Date;
}

const heightRangeSchema = new Schema<ISizeHeightRange>(
  {
    minHeightCm: { type: Number, required: true, min: MIN_BODY_HEIGHT_CM, max: MAX_BODY_HEIGHT_CM },
    maxHeightCm: { type: Number, required: true, min: MIN_BODY_HEIGHT_CM, max: MAX_BODY_HEIGHT_CM },
  },
  { _id: false },
);

const sizeCategoryOverrideSchema = new Schema<ISizeCategoryOverride>(
  {
    categoryId: { type: Schema.Types.ObjectId, required: true },
    minHeightCm: { type: Number, required: true, min: MIN_BODY_HEIGHT_CM, max: MAX_BODY_HEIGHT_CM },
    maxHeightCm: { type: Number, required: true, min: MIN_BODY_HEIGHT_CM, max: MAX_BODY_HEIGHT_CM },
  },
  { _id: false },
);

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
      heightRange: { type: heightRangeSchema, required: false },
      categoryOverrides: { type: [sizeCategoryOverrideSchema], default: [] },
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
