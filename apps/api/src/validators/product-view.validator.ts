import type { ItemType } from "@bw-bikes/shared";
import Joi from "joi";
import { objectId, sku } from "./common.validator.js";

const ITEM_TYPES: ItemType[] = ["bike", "accessory"];

/** Body of the anonymous `POST /catalog/views` event. Every field but `itemType`/`itemId` is optional. */
export const productViewSchema = Joi.object({
  itemType: Joi.string()
    .valid(...ITEM_TYPES)
    .required()
    .messages({
      "any.only": "El tipo de producto no es válido.",
      "any.required": "El tipo de producto es obligatorio.",
    }),
  itemId: objectId.required(),
  sku: sku.optional(),
  size: Joi.string().trim().max(16).optional(),
});
