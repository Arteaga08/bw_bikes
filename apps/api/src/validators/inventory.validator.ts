import type { ItemType } from "@bw-bikes/shared";
import Joi from "joi";
import { MAX_ON_HAND } from "../models/index.js";
import { objectId, sku } from "./common.validator.js";
import { pagination } from "./list-query.validator.js";

const ITEM_TYPES: ItemType[] = ["bike", "accessory"];

const itemType = Joi.string()
  .valid(...ITEM_TYPES)
  .messages({
    "any.only": "El tipo de producto no es válido.",
    "any.required": "El tipo de producto es obligatorio.",
  });

const onHand = Joi.number().integer().min(0).max(MAX_ON_HAND).messages({
  "number.base": "El stock físico debe ser un número.",
  "number.integer": "El stock físico debe ser un número entero de unidades.",
  "number.min": "El stock físico no puede ser negativo.",
  "number.max": `El stock físico no puede exceder ${MAX_ON_HAND} unidades.`,
});

/**
 * Inventory rows are created by hand and point at an existing variant — the
 * service checks that the `{ itemType, itemId, sku }` triplet resolves to a
 * real one before writing anything.
 *
 * `reserved` is deliberately not accepted: it is a derived operational
 * counter, only ever moved by a reservation. Letting an admin set it would
 * hand them a way to make availability lie.
 */
const lowStockThreshold = Joi.number().integer().min(0).max(MAX_ON_HAND).messages({
  "number.base": "El umbral de stock bajo debe ser un número.",
  "number.integer": "El umbral de stock bajo debe ser un número entero de unidades.",
  "number.min": "El umbral de stock bajo no puede ser negativo.",
  "number.max": `El umbral de stock bajo no puede exceder ${MAX_ON_HAND} unidades.`,
});

export const createInventoryItemSchema = Joi.object({
  itemType: itemType.required(),
  itemId: objectId.required().messages({ "string.pattern.base": "El producto es inválido." }),
  sku: sku.required(),
  onHand: onHand.default(0),
  lowStockThreshold: lowStockThreshold.optional(),
});

/**
 * Two ways to move physical stock, never both at once:
 *
 * - `onHand` overwrites — a physical recount, where overwriting is the intent.
 * - `delta` adds — a shipment received or units written off, so two admins
 *   working at the same time add up instead of clobbering each other.
 */
export const adjustStockSchema = Joi.object({
  onHand: onHand.optional(),
  delta: Joi.number()
    .integer()
    .min(-MAX_ON_HAND)
    .max(MAX_ON_HAND)
    .invalid(0)
    .optional()
    .messages({
      "number.base": "El ajuste debe ser un número.",
      "number.integer": "El ajuste debe ser un número entero de unidades.",
      "any.invalid": "El ajuste no puede ser cero.",
    }),
  reason: Joi.string().trim().max(200).optional().messages({
    "string.max": "El motivo no puede exceder 200 caracteres.",
  }),
})
  .xor("onHand", "delta")
  .messages({
    "object.xor": "Indica el nuevo stock físico (onHand) o un ajuste (delta), pero no ambos.",
    "object.missing": "Indica el nuevo stock físico (onHand) o un ajuste (delta).",
  });

export const inventoryListQuerySchema = Joi.object({
  ...pagination,
  itemType: itemType.optional(),
  itemId: objectId.optional().messages({ "string.pattern.base": "El producto es inválido." }),
  stock: Joi.string().valid("low", "out").optional().messages({
    "any.only": 'El filtro de stock debe ser "low" u "out".',
  }),
  // A root category id — requires `itemType` too, since bikes and accessories
  // are two independent trees and the id alone doesn't say which one.
  category: objectId.optional().messages({ "string.pattern.base": "La categoría es inválida." }),
});
