import type { ItemType } from "@bw-bikes/shared";
import Joi from "joi";
import { MAX_RESERVATION_QTY } from "../models/index.js";
import { objectId, sku } from "./common.validator.js";

const ITEM_TYPES: ItemType[] = ["bike", "accessory"];

const itemType = Joi.string()
  .valid(...ITEM_TYPES)
  .messages({
    "any.only": "El tipo de producto no es válido.",
    "any.required": "El tipo de producto es obligatorio.",
  });

const qty = Joi.number().integer().min(1).max(MAX_RESERVATION_QTY).messages({
  "number.base": "La cantidad debe ser un número.",
  "number.integer": "La cantidad debe ser un número entero de unidades.",
  "number.min": "La cantidad debe ser al menos 1.",
  "number.max": `No puedes agregar más de ${MAX_RESERVATION_QTY} unidades de un mismo producto.`,
  "any.required": "La cantidad es obligatoria.",
});

/**
 * A cart line says **what** is being bought, never for how much.
 *
 * There is no `price`, `unitPriceCents` or `total` field here, and that is the
 * point: with Joi's `stripUnknown` any such key a client sends is discarded
 * before the controller ever sees it. The amount is re-read from the catalog
 * on every render and frozen only when the order is created.
 */
export const addCartLineSchema = Joi.object({
  itemType: itemType.required(),
  itemId: objectId.required().messages({ "string.pattern.base": "El producto es inválido." }),
  sku: sku.required(),
  qty: qty.required(),
});

/** Absolute quantity, which is what a stepper control in the storefront produces. */
export const updateCartLineSchema = Joi.object({ qty: qty.required() });

/**
 * Both parts of a line's identity travel in the path. The SKU alone is not
 * enough: M3 made SKUs unique per collection, not globally, so a bike and an
 * accessory may share one.
 */
export const cartLineParamSchema = Joi.object({
  itemType: itemType.required(),
  sku: sku.required(),
});
