import type { WishlistItem } from "@bw-bikes/shared";
import { Schema, type Types } from "mongoose";

export const MAX_WISHLIST_ITEMS = 50;

/**
 * The Mongoose-side shape of a `User.wishlist` entry: same fields as the
 * shared `WishlistItem` DTO, `itemId` cast to a real `Types.ObjectId`.
 * `_id: false` — like `fitSchema`'s `gearSizes`, an entry is addressed by its
 * own `(itemType, itemId)` pair (`DELETE /account/wishlist/:itemType/:itemId`),
 * never by a subdocument id of its own.
 */
export interface IWishlistEntry extends Omit<WishlistItem, "itemId" | "addedAt"> {
  itemId: Types.ObjectId;
  addedAt: Date;
}

export const wishlistEntrySchema = new Schema<IWishlistEntry>(
  {
    itemType: { type: String, enum: ["bike", "accessory"], required: true },
    itemId: { type: Schema.Types.ObjectId, required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);
