import { type Document, Schema, Types, model } from "mongoose";
import type { ICategoryImage } from "./category.model.js";
import { categoryImageSchema } from "./schemas/category-image.schema.js";

/**
 * The home's single "bici del mes" banner (M12) — exactly one document,
 * upserted lazily by `bike-of-month.service.ts` the same way `HomeTile` seeds
 * its two slots. Unlike `HomeTile` there is editable text and a catalog
 * reference (`bikeId`), resolved to an `href` at read time the same way a
 * hero CTA's `refId` is — but unlike a hero CTA, only one target type
 * ("bike") ever applies, and the two buttons' labels are hardcoded in the
 * storefront rather than stored here.
 */
export interface IBikeOfMonth extends Document {
  eyebrow?: string;
  /** Unset until the admin saves the form the first time — the singleton is upserted empty, same as `HomeTile`'s slots. */
  title?: string;
  subtitle?: string;
  bikeId?: Types.ObjectId;
  /** Unset until the first upload — same text-first-then-image flow as `IHeroSlide.image`. */
  image?: ICategoryImage;
  createdAt: Date;
  updatedAt: Date;
}

const bikeOfMonthSchema = new Schema<IBikeOfMonth>(
  {
    eyebrow: { type: String, required: false },
    title: { type: String, required: false },
    subtitle: { type: String, required: false },
    bikeId: { type: Schema.Types.ObjectId, ref: "Bike", required: false },
    image: { type: categoryImageSchema, required: false },
  },
  { timestamps: true },
);

export const BikeOfMonth = model<IBikeOfMonth>("BikeOfMonth", bikeOfMonthSchema);
