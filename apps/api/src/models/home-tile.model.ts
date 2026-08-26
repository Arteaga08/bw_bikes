import { HOME_TILE_SLOTS, type HomeTileSlot } from "@bw-bikes/shared";
import { type Document, model, Schema } from "mongoose";
import type { ICategoryImage } from "./category.model.js";
import { categoryImageSchema } from "./schemas/category-image.schema.js";

/**
 * The home's "comprar bicis/accesorios" CTA tiles (M12, entrega 6) — exactly
 * two documents, one per `HOME_TILE_SLOTS` entry, each carrying only a photo.
 * Unlike `HeroSlide` there is no title, subtitle, or CTA to store: the label
 * and destination are hardcoded in the storefront (`HomeCategoryCtas.tsx`),
 * so this collection exists purely to let the admin manage the two photos
 * without a code deploy.
 *
 * `slot` is unique rather than this being a `Settings` section because it's
 * image-bearing and read anonymously — same reasoning `content.ts` documents
 * for `HeroSlide` vs. `Settings`.
 */
export interface IHomeTile extends Document {
  slot: HomeTileSlot;
  /** Unset until the first upload — a slot exists (seeded by `home-tile.service.ts`) before it has a photo. */
  image?: ICategoryImage;
  createdAt: Date;
  updatedAt: Date;
}

const homeTileSchema = new Schema<IHomeTile>(
  {
    slot: { type: String, enum: [...HOME_TILE_SLOTS], required: true, unique: true },
    image: { type: categoryImageSchema, required: false },
  },
  { timestamps: true },
);

export const HomeTile = model<IHomeTile>("HomeTile", homeTileSchema);
