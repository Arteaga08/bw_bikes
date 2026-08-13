import type { ProductImage, ProductVariant, SpecGroup } from "@bw-bikes/shared";
import { type Document, model, Schema, type Types } from "mongoose";
import { MAX_DESCRIPTION_LENGTH, MAX_PRODUCT_BADGES, MAX_PRODUCT_NAME_LENGTH } from "./bike.model.js";
import { MAX_GALLERY_IMAGES, productImageSchema } from "./schemas/product-image.schema.js";
import { MAX_PRICE_CENTS, MAX_VARIANTS, productVariantSchema } from "./schemas/product-variant.schema.js";
import { MAX_SPEC_GROUPS, specGroupSchema } from "./schemas/spec-group.schema.js";

export interface IAccessory extends Document {
  name: string;
  slug: string;
  brand: Types.ObjectId;
  category: Types.ObjectId;
  description: string;
  price: number;
  compareAtPrice?: number;
  variants: ProductVariant[];
  specGroups: SpecGroup[];
  gallery: ProductImage[];
  badges: Types.ObjectId[];
  isActive: boolean;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The second, independent catalog entity. It deliberately does **not** share a
 * base schema with `Bike`: the client asked for two separate entities and they
 * genuinely differ (no `shortDescription`, no cross-sell list, and a
 * different category tree). What they share are the embedded
 * sub-schemas — variants, spec groups, gallery — which is where duplication
 * would actually have hurt.
 */
const accessorySchema = new Schema<IAccessory>(
  {
    name: { type: String, required: true, trim: true, maxlength: MAX_PRODUCT_NAME_LENGTH },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    brand: { type: Schema.Types.ObjectId, ref: "Brand", required: true, index: true },
    category: { type: Schema.Types.ObjectId, ref: "AccessoryCategory", required: true },

    description: { type: String, required: true, trim: true, maxlength: MAX_DESCRIPTION_LENGTH },

    price: { type: Number, required: true, min: 0, max: MAX_PRICE_CENTS },
    compareAtPrice: { type: Number, min: 0, max: MAX_PRICE_CENTS },

    variants: {
      type: [productVariantSchema],
      default: [],
      validate: {
        validator: (variants: unknown[]) => variants.length <= MAX_VARIANTS,
        message: `Un accesorio no puede tener más de ${MAX_VARIANTS} variantes.`,
      },
    },
    specGroups: {
      type: [specGroupSchema],
      default: [],
      validate: {
        validator: (groups: unknown[]) => groups.length <= MAX_SPEC_GROUPS,
        message: `La ficha técnica no puede tener más de ${MAX_SPEC_GROUPS} grupos.`,
      },
    },
    gallery: {
      type: [productImageSchema],
      default: [],
      validate: {
        validator: (images: unknown[]) => images.length <= MAX_GALLERY_IMAGES,
        message: `La galería no puede tener más de ${MAX_GALLERY_IMAGES} imágenes.`,
      },
    },

    // Merchandising badges ("Novedad", "Bestseller") — see `badge.model.ts`.
    badges: {
      type: [{ type: Schema.Types.ObjectId, ref: "Badge" }],
      default: [],
      validate: {
        validator: (ids: unknown[]) => ids.length <= MAX_PRODUCT_BADGES,
        message: `Solo se puede asignar ${MAX_PRODUCT_BADGES} badge por producto.`,
      },
    },

    isActive: { type: Boolean, default: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

accessorySchema.index({ "variants.sku": 1 }, { unique: true, sparse: true });
accessorySchema.index({ category: 1, isActive: 1, price: 1 });

export const Accessory = model<IAccessory>("Accessory", accessorySchema);
