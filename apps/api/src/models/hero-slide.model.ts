import {
  HERO_CTA_TARGET_TYPES,
  HERO_FOCAL_POINTS,
  type HeroCtaTargetType,
  type HeroFocalPoint,
  MAX_HERO_CTA_LABEL_LENGTH,
  MAX_HERO_CTA_URL_LENGTH,
  MAX_HERO_CTAS_PER_SLIDE,
  MAX_HERO_EYEBROW_LENGTH,
  MAX_HERO_SUBTITLE_LENGTH,
  MAX_HERO_TITLE_LENGTH,
} from "@bw-bikes/shared";
import { type Document, model, Schema, type Types } from "mongoose";
import type { ICategoryImage } from "./category.model.js";
import { categoryImageSchema } from "./schemas/category-image.schema.js";

/**
 * Which collection a CTA's `refId` points into, per target type. Mongoose's
 * `refPath` needs a *path* holding a model name, and storing the model name
 * on the document would duplicate `type` in a second, drift-prone field. The
 * populate is therefore done explicitly in the service with this map, which
 * also keeps the model names in one place instead of spread across query
 * call sites.
 *
 * `"url"` has no entry on purpose — a free path references no document, and
 * the absence here is what makes "did I remember to handle the url case"
 * a type error rather than a runtime surprise.
 */
export const HERO_CTA_REF_MODELS: Record<Exclude<HeroCtaTargetType, "url">, string> = {
  bike: "Bike",
  bikeCategory: "BikeCategory",
  accessory: "Accessory",
  accessoryCategory: "AccessoryCategory",
};

export interface IHeroCtaTarget {
  type: HeroCtaTargetType;
  refId?: Types.ObjectId;
  url?: string;
}

export interface IHeroSlideCta {
  label: string;
  target: IHeroCtaTarget;
}

export interface IHeroSlide extends Document {
  /**
   * Optional at the schema level, same reasoning as `Category.image`/
   * `Brand.logo`: creation is text-first, then the image is set through its
   * own call (`setImage`), which is what lets `HeroSlideFormModal` stage the
   * file locally and upload it right after the slide exists — one save
   * action for the admin, two requests underneath. A slide with no image yet
   * is real but incomplete: `listPublic` excludes it regardless of
   * `isActive`, so an in-progress slide can never reach a real visitor.
   */
  image?: ICategoryImage;
  focalPoint: HeroFocalPoint;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  ctas: IHeroSlideCta[];
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const heroCtaTargetSchema = new Schema<IHeroCtaTarget>(
  {
    type: { type: String, enum: [...HERO_CTA_TARGET_TYPES], required: true },
    // No `refPath` and no `ref`: the collection is decided by `type` via
    // `HERO_CTA_REF_MODELS` at query time (see above). Untyped here means the
    // service must resolve it deliberately, which is what lets an archived or
    // deleted destination be *detected* rather than silently populated as null.
    refId: { type: Schema.Types.ObjectId },
    url: { type: String, trim: true, maxlength: MAX_HERO_CTA_URL_LENGTH },
  },
  { _id: false },
);

const heroCtaSchema = new Schema<IHeroSlideCta>(
  {
    label: { type: String, required: true, trim: true, maxlength: MAX_HERO_CTA_LABEL_LENGTH },
    target: { type: heroCtaTargetSchema, required: true },
  },
  { _id: false },
);

/**
 * One slide of the home page's hero carousel (M12, entrega 2). Content, not
 * configuration: it carries an image, an order, and is read anonymously —
 * which is why it is its own collection rather than a section of the
 * `Settings` singleton (numeric config, admin-only, no public read path).
 *
 * The document cap (`MAX_HERO_SLIDES`) is enforced in the service, not here:
 * a schema can constrain a document's own shape but cannot count its
 * siblings.
 */
const heroSlideSchema = new Schema<IHeroSlide>(
  {
    image: { type: categoryImageSchema, required: false },
    focalPoint: { type: String, enum: [...HERO_FOCAL_POINTS], required: true, default: "center" },
    eyebrow: { type: String, trim: true, maxlength: MAX_HERO_EYEBROW_LENGTH },
    title: { type: String, required: true, trim: true, maxlength: MAX_HERO_TITLE_LENGTH },
    subtitle: { type: String, trim: true, maxlength: MAX_HERO_SUBTITLE_LENGTH },
    ctas: {
      type: [heroCtaSchema],
      required: true,
      validate: {
        validator: (ctas: IHeroSlideCta[]) => ctas.length >= 1 && ctas.length <= MAX_HERO_CTAS_PER_SLIDE,
        message: `Cada slide necesita entre 1 y ${MAX_HERO_CTAS_PER_SLIDE} botones.`,
      },
    },
    order: { type: Number, required: true, min: 0, default: 0 },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

/**
 * Both reads this collection ever does are "every slide, in display order" —
 * the admin list and the public carousel, the second additionally filtered
 * by `isActive`. `_id` breaks ties so two slides sharing an `order` (possible
 * mid-reorder) still come back in a stable sequence rather than a different
 * one per request.
 */
heroSlideSchema.index({ order: 1, _id: 1 });

export const HeroSlide = model<IHeroSlide>("HeroSlide", heroSlideSchema);
