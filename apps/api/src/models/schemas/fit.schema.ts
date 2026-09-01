import type { CustomerFit, GearSize } from "@bw-bikes/shared";
import { GEAR_SIZE_CATEGORIES, MAX_GEAR_SIZES, RIDE_STYLE_VALUES } from "@bw-bikes/shared";
import { Schema } from "mongoose";

// 100-230: MIN/MAX_HEIGHT_CM of `SizeGuideModal.tsx` (140-210) widened a bit
// so real edge cases aren't blocked (A4-mis-tallas.md).
export const MIN_HEIGHT_CM = 100;
export const MAX_HEIGHT_CM = 230;
export const MAX_GEAR_SIZE_VALUE_LENGTH = 20;

const gearSizeSchema = new Schema<GearSize>(
  {
    category: { type: String, enum: [...GEAR_SIZE_CATEGORIES], required: true },
    value: { type: String, required: true, trim: true, maxlength: MAX_GEAR_SIZE_VALUE_LENGTH },
  },
  { _id: false },
);

/**
 * The customer's fit profile (`User.fit`, A4). `_id: false`, same reasoning
 * as `billingInfoSchema`: a property of its parent document, replaced whole
 * by `PUT /account/fit`, not an addressable sub-resource.
 */
export const fitSchema = new Schema<CustomerFit>(
  {
    heightCm: { type: Number, min: MIN_HEIGHT_CM, max: MAX_HEIGHT_CM },
    rideStyle: { type: String, enum: [...RIDE_STYLE_VALUES] },
    gearSizes: {
      type: [gearSizeSchema],
      default: [],
      validate: {
        validator: (gearSizes: GearSize[]) =>
          gearSizes.length <= MAX_GEAR_SIZES && new Set(gearSizes.map((size) => size.category)).size === gearSizes.length,
        message: `No puedes guardar más de ${MAX_GEAR_SIZES} tallas de equipamiento ni repetir una categoría.`,
      },
    },
  },
  { _id: false },
);
