import { type Document, model, Schema, type Types } from "mongoose";
import { categoryImageSchema } from "./schemas/category-image.schema.js";

export const MAX_CATEGORY_NAME_LENGTH = 80;
export const MAX_CATEGORY_DESCRIPTION_LENGTH = 400;

export interface ICategoryImage {
  publicId: string;
  url: string;
  width: number;
  height: number;
  alt?: string;
}

export interface ICategory extends Document {
  name: string;
  slug: string;
  description?: string;
  /** `null` at the root. Two levels maximum — enforced in the service, which can read the parent. */
  parent: Types.ObjectId | null;
  order: number;
  isActive: boolean;
  /** When `false`, products in this category don't manage sizes — the editor's "Tallas y variantes" step skips `SizePicker` entirely. Default `true`: most categories do use sizes. */
  usesSizes: boolean;
  /** Optional, single image (M10.2) — set/replaced/cleared via `category.service.ts`'s `setImage`/`removeImage`, never via the plain create/update payload. */
  image?: ICategoryImage;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * One schema engine, instantiated twice (`BikeCategory`, `AccessoryCategory`).
 *
 * The client asked for two genuinely independent category trees, and that's
 * what this produces: two collections, two CRUDs, two slug namespaces that
 * can't collide with each other. Sharing the schema definition is what keeps
 * the two from silently drifting apart — a copy-pasted second schema is the
 * kind of duplication that grows a different `maxlength` on one side six
 * months later and nobody notices.
 *
 * The two-level rule is not expressible here (it requires reading the parent
 * document), so it lives in `category.service.ts`.
 */
function buildCategorySchema(): Schema<ICategory> {
  const schema = new Schema<ICategory>(
    {
      name: { type: String, required: true, trim: true, maxlength: MAX_CATEGORY_NAME_LENGTH },
      slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
      description: { type: String, trim: true, maxlength: MAX_CATEGORY_DESCRIPTION_LENGTH },
      parent: { type: Schema.Types.ObjectId, default: null },
      order: { type: Number, default: 0, min: 0 },
      isActive: { type: Boolean, default: true },
      usesSizes: { type: Boolean, default: true },
      image: { type: categoryImageSchema, required: false },
    },
    { timestamps: true },
  );

  // Drives both the admin tree view and the storefront nav, which always read
  // "children of X, in display order".
  schema.index({ parent: 1, order: 1 });

  return schema;
}

/**
 * `ref` is passed explicitly so `parent` points at the *same* collection the
 * model belongs to — a bike category's parent must never resolve to an
 * accessory category.
 */
function createCategoryModel(modelName: string) {
  const schema = buildCategorySchema();
  schema.path("parent").options.ref = modelName;
  return model<ICategory>(modelName, schema);
}

export const BikeCategory = createCategoryModel("BikeCategory");
export const AccessoryCategory = createCategoryModel("AccessoryCategory");

/** The two category models share an interface, so services can be written once against this type. */
export type CategoryModel = typeof BikeCategory;
