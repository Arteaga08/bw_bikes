import type { BrakeType, FulfillmentMode } from "@bw-bikes/shared";
import Joi from "joi";
import {
  MAX_BRAND_LENGTH,
  MAX_COLOR_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_PRODUCT_NAME_LENGTH,
  MAX_RELATED_ACCESSORIES,
  MAX_SHORT_DESCRIPTION_LENGTH,
  MAX_SIZE_LENGTH,
  MAX_VARIANTS,
} from "../models/index.js";
import { objectId, priceCents, sku, slug } from "./common.validator.js";
import { specGroupSchemaJoi } from "./spec-group.validator.js";

const FULFILLMENT_MODES: FulfillmentMode[] = ["in_stock", "on_request", "preorder"];
const BRAKE_TYPES: BrakeType[] = ["hydraulic_disc", "mechanical_disc", "rim"];

const name = Joi.string().trim().min(2).max(MAX_PRODUCT_NAME_LENGTH).messages({
  "string.empty": "El nombre es obligatorio.",
  "string.min": "El nombre debe tener al menos 2 caracteres.",
  "string.max": `El nombre no puede exceder ${MAX_PRODUCT_NAME_LENGTH} caracteres.`,
  "any.required": "El nombre es obligatorio.",
});

const brand = Joi.string().trim().min(1).max(MAX_BRAND_LENGTH).messages({
  "string.empty": "La marca es obligatoria.",
  "string.max": `La marca no puede exceder ${MAX_BRAND_LENGTH} caracteres.`,
  "any.required": "La marca es obligatoria.",
});

const description = Joi.string().trim().min(1).max(MAX_DESCRIPTION_LENGTH).messages({
  "string.empty": "La descripción es obligatoria.",
  "string.max": `La descripción no puede exceder ${MAX_DESCRIPTION_LENGTH} caracteres.`,
  "any.required": "La descripción es obligatoria.",
});

const shortDescription = Joi.string().trim().min(1).max(MAX_SHORT_DESCRIPTION_LENGTH).messages({
  "string.empty": "La descripción corta es obligatoria.",
  "string.max": `La descripción corta no puede exceder ${MAX_SHORT_DESCRIPTION_LENGTH} caracteres.`,
  "any.required": "La descripción corta es obligatoria.",
});

const variant = Joi.object({
  sku: sku.required(),
  size: Joi.string().trim().max(MAX_SIZE_LENGTH).allow("").optional(),
  color: Joi.string().trim().max(MAX_COLOR_LENGTH).allow("").optional(),
  // Optional override of the product price — absent means "use the product's".
  price: priceCents.optional(),
  fulfillmentMode: Joi.string()
    .valid(...FULFILLMENT_MODES)
    .default("in_stock")
    .messages({ "any.only": "El modo de disponibilidad no es válido." }),
  // Only meaningful for `preorder`; harmless elsewhere, so it isn't tied to
  // `fulfillmentMode` with a conditional — a cross-field rule here would have
  // to resolve against a sibling that itself carries a default.
  preorderReleaseDate: Joi.date().iso().optional().messages({
    "date.base": "La fecha estimada de preventa no es válida.",
    "date.format": "La fecha estimada de preventa debe estar en formato ISO.",
  }),
  isActive: Joi.boolean().default(true),
});

const variants = Joi.array().items(variant).max(MAX_VARIANTS).messages({
  "array.max": `No se pueden registrar más de ${MAX_VARIANTS} variantes.`,
});

const specGroups = Joi.array().items(specGroupSchemaJoi).messages({
  "array.base": "La ficha técnica debe ser una lista de grupos.",
});

/**
 * `compareAtPrice` is the struck-through "precio anterior". It must sit above
 * the real price — a fake discount where the compare price is lower is both a
 * UI bug and, in Mexico, a PROFECO problem.
 */
const compareAtPrice = priceCents.greater(Joi.ref("price")).messages({
  "number.greater": "El precio anterior debe ser mayor al precio actual.",
});

/** Fields shared by both catalogs. Neither `isActive` nor `archivedAt` is ever accepted from a payload. */
const productBase = {
  name,
  slug: slug.optional(),
  brand,
  category: objectId.messages({ "string.pattern.base": "La categoría es inválida." }),
  description,
  price: priceCents,
  compareAtPrice: compareAtPrice.optional(),
  variants: variants.optional(),
  specGroups: specGroups.optional(),
};

const relatedAccessories = Joi.array()
  .items(objectId)
  .max(MAX_RELATED_ACCESSORIES)
  .unique()
  .messages({
    "array.max": `No se pueden sugerir más de ${MAX_RELATED_ACCESSORIES} accesorios.`,
    "array.unique": "Hay accesorios sugeridos repetidos.",
  });

export const createBikeSchema = Joi.object({
  ...productBase,
  name: name.required(),
  brand: brand.required(),
  category: productBase.category.required(),
  description: description.required(),
  shortDescription: shortDescription.required(),
  price: priceCents.required(),
  brakeType: Joi.string()
    .valid(...BRAKE_TYPES)
    .required()
    .messages({
      "any.only": "El tipo de freno no es válido.",
      "any.required": "El tipo de freno es obligatorio.",
    }),
  relatedAccessories: relatedAccessories.default([]),
});

export const updateBikeSchema = Joi.object({
  ...productBase,
  shortDescription: shortDescription.optional(),
  brakeType: Joi.string()
    .valid(...BRAKE_TYPES)
    .optional()
    .messages({ "any.only": "El tipo de freno no es válido." }),
  relatedAccessories: relatedAccessories.optional(),
})
  .min(1)
  .messages({ "object.min": "Envía al menos un campo para actualizar." });

export const createAccessorySchema = Joi.object({
  ...productBase,
  name: name.required(),
  brand: brand.required(),
  category: productBase.category.required(),
  description: description.required(),
  price: priceCents.required(),
});

export const updateAccessorySchema = Joi.object(productBase)
  .min(1)
  .messages({ "object.min": "Envía al menos un campo para actualizar." });
