import type { ProductImage, ProductVariant, SpecGroup } from "@bw-bikes/shared";
import { type Document, model, Schema, type Types } from "mongoose";
import { MAX_GALLERY_IMAGES, productImageSchema } from "./schemas/product-image.schema.js";
import { MAX_PRICE_CENTS, MAX_VARIANTS, productVariantSchema } from "./schemas/product-variant.schema.js";
import { MAX_SPEC_GROUPS, specGroupSchema } from "./schemas/spec-group.schema.js";

export const MAX_PRODUCT_NAME_LENGTH = 140;
/** Only used to bound the **snapshot** brand name frozen onto an order line (`order-line.schema.ts`) — `Bike.brand`/`Accessory.brand` themselves are a `Brand` reference, not a string; see `brand.model.ts`'s own `MAX_BRAND_NAME_LENGTH`. */
export const MAX_BRAND_LENGTH = 60;
export const MAX_SHORT_DESCRIPTION_LENGTH = 300;
export const MAX_DESCRIPTION_LENGTH = 5000;
/** Cross-sell is curated by hand; past a dozen it stops being a curation. */
export const MAX_RELATED_ACCESSORIES = 12;
/** More than one merchandising badge stops reading as "highlighted" and starts reading as noise. */
export const MAX_PRODUCT_BADGES = 1;

export interface IBike extends Document {
  name: string;
  slug: string;
  brand: Types.ObjectId;
  category: Types.ObjectId;
  shortDescription: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  variants: ProductVariant[];
  specGroups: SpecGroup[];
  gallery: ProductImage[];
  relatedAccessories: Types.ObjectId[];
  badges: Types.ObjectId[];
  isActive: boolean;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const bikeSchema = new Schema<IBike>(
  {
    name: { type: String, required: true, trim: true, maxlength: MAX_PRODUCT_NAME_LENGTH },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // First-class filter fields. The free-form spec sheet is display-only, so
    // anything the storefront filters on must be a typed column here — that's
    // the trade-off the client accepted for a template-less ficha técnica.
    brand: { type: Schema.Types.ObjectId, ref: "Brand", required: true, index: true },
    category: { type: Schema.Types.ObjectId, ref: "BikeCategory", required: true },

    shortDescription: { type: String, required: true, trim: true, maxlength: MAX_SHORT_DESCRIPTION_LENGTH },
    description: { type: String, required: true, trim: true, maxlength: MAX_DESCRIPTION_LENGTH },

    // Integer cents, never a float — see `PriceCents` in packages/shared.
    price: { type: Number, required: true, min: 0, max: MAX_PRICE_CENTS },
    compareAtPrice: { type: Number, min: 0, max: MAX_PRICE_CENTS },

    variants: {
      type: [productVariantSchema],
      default: [],
      validate: {
        validator: (variants: unknown[]) => variants.length <= MAX_VARIANTS,
        message: `Una bicicleta no puede tener más de ${MAX_VARIANTS} variantes.`,
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

    // Manual curation by the admin (design spec §"Cross-sell"): the PDP
    // suggests accessories that complete the purchase.
    relatedAccessories: {
      type: [{ type: Schema.Types.ObjectId, ref: "Accessory" }],
      default: [],
      validate: {
        validator: (ids: unknown[]) => ids.length <= MAX_RELATED_ACCESSORIES,
        message: `No se pueden sugerir más de ${MAX_RELATED_ACCESSORIES} accesorios.`,
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

    // Archiving is a logical delete: a bike that was ever purchasable keeps
    // existing so inventory (M4) and order history (M5) never point at a hole.
    isActive: { type: Boolean, default: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// A SKU identifies a variant within this catalog. `itemType` disambiguates
// against the accessory catalog, so uniqueness is per collection.
bikeSchema.index({ "variants.sku": 1 }, { unique: true, sparse: true });
// The storefront's primary query: active bikes of a category, cheapest first.
bikeSchema.index({ category: 1, isActive: 1, price: 1 });

export const Bike = model<IBike>("Bike", bikeSchema);
