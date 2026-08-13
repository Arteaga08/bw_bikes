import type { BadgeVariant } from "@bw-bikes/shared";
import { type Document, model, Schema } from "mongoose";

export const MAX_BADGE_LABEL_LENGTH = 24;

const BADGE_VARIANTS: BadgeVariant[] = ["accent", "unavailable", "exito", "advertencia", "error", "neutral"];

export interface IBadge extends Document {
  label: string;
  slug: string;
  /** One of the design system's closed set (`components/ui/Badge.tsx`) — never a free hex. */
  variant: BadgeVariant;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Merchandising badges ("Novedad", "Bestseller") an admin assigns to a
 * product, resolved on the PDP as `components/ui/Badge.tsx` chips. One
 * collection shared by both catalogs, same reasoning as `Brand`: a badge
 * like "Oferta" isn't scoped to bikes or accessories.
 */
const badgeSchema = new Schema<IBadge>(
  {
    label: { type: String, required: true, trim: true, unique: true, maxlength: MAX_BADGE_LABEL_LENGTH },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    variant: { type: String, enum: BADGE_VARIANTS, required: true },
    order: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

badgeSchema.index({ order: 1, label: 1 });

export const Badge = model<IBadge>("Badge", badgeSchema);
