import type { FulfillmentMode } from "@bw-bikes/shared";
import Joi from "joi";
import {
  MAX_COLOR_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_ON_HAND,
  MAX_PRODUCT_BADGES,
  MAX_PRODUCT_NAME_LENGTH,
  MAX_RELATED_ACCESSORIES,
  MAX_SHORT_DESCRIPTION_LENGTH,
  MAX_SIZE_LENGTH,
  MAX_SPEC_LABEL_LENGTH,
  MAX_SPEC_VALUE_LENGTH,
  MAX_SUMMARY_ROWS,
  MAX_VARIANTS,
} from "../models/index.js";
import { objectId, priceCents, sku, slug } from "./common.validator.js";
import { specGroupSchemaJoi } from "./spec-group.validator.js";

const FULFILLMENT_MODES: FulfillmentMode[] = ["in_stock", "on_request", "preorder"];

const name = Joi.string().trim().min(2).max(MAX_PRODUCT_NAME_LENGTH).messages({
  "string.empty": "El nombre es obligatorio.",
  "string.min": "El nombre debe tener al menos 2 caracteres.",
  "string.max": `El nombre no puede exceder ${MAX_PRODUCT_NAME_LENGTH} caracteres.`,
  "any.required": "El nombre es obligatorio.",
});

/** A reference to `Brand`, not free text — see `brand.model.ts`. */
const brand = objectId.messages({
  "string.empty": "La marca es obligatoria.",
  "string.pattern.base": "La marca es inválida.",
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

/**
 * `initialStock` seeds `InventoryItem.onHand` for an `in_stock` variant (M11
 * create, M11.x a variant added mid-edit) — see `bike.service.ts`'s
 * `create`/`update`. Kept out of the plain `variant`/`variants` schemas
 * above on purpose, but — unlike the milestone that introduced it —
 * accepting it on `PATCH` is now safe: the anti-stale-overwrite guarantee
 * lives at the service layer (`product.service.ts`'s `partitionNewVariants`),
 * which only ever acts on `initialStock` for a SKU that wasn't already on the
 * product before this PATCH. A value sent for an already-persisted SKU is
 * accepted by Joi but ignored by the service, same as `fulfillmentMode`
 * isn't cross-validated against it here — a value sent for
 * `on_request`/`preorder` is simply ignored too, same as the UI never
 * renders the field for those modes.
 */
const initialStock = Joi.number().integer().min(0).max(MAX_ON_HAND).messages({
  "number.base": "El stock inicial debe ser un número.",
  "number.integer": "El stock inicial debe ser un número entero de unidades.",
  "number.min": "El stock inicial no puede ser negativo.",
  "number.max": `El stock inicial no puede exceder ${MAX_ON_HAND} unidades.`,
});

const variantWithInitialStock = variant.keys({ initialStock: initialStock.optional() });

const variantsWithInitialStock = Joi.array().items(variantWithInitialStock).max(MAX_VARIANTS).messages({
  "array.max": `No se pueden registrar más de ${MAX_VARIANTS} variantes.`,
});

const specGroups = Joi.array().items(specGroupSchemaJoi).messages({
  "array.base": "La ficha técnica debe ser una lista de grupos.",
});

/**
 * The bike-only "En pocas palabras" card (M10.6). Six bounded rows don't
 * justify an endpoint of their own, so unlike `specGroups` — whose editor
 * needs the atomic `PUT /spec-groups` — this rides in the product's own body.
 *
 * Attached to the bike schemas below rather than to `productBase`: that's
 * what keeps accessories, which have no overview block, from accepting it.
 */
const summaryRow = Joi.object({
  label: Joi.string().trim().min(1).max(MAX_SPEC_LABEL_LENGTH).required().messages({
    "string.empty": "La etiqueta del resumen es obligatoria.",
    "string.max": `La etiqueta no puede exceder ${MAX_SPEC_LABEL_LENGTH} caracteres.`,
    "any.required": "La etiqueta del resumen es obligatoria.",
  }),
  value: Joi.string().trim().min(1).max(MAX_SPEC_VALUE_LENGTH).required().messages({
    "string.empty": "El valor del resumen es obligatorio.",
    "string.max": `El valor no puede exceder ${MAX_SPEC_VALUE_LENGTH} caracteres.`,
    "any.required": "El valor del resumen es obligatorio.",
  }),
  order: Joi.number().integer().min(0).max(999).required().messages({
    "number.base": "El orden debe ser un número.",
    "any.required": "El orden es obligatorio.",
  }),
});

const summary = Joi.array().items(summaryRow).max(MAX_SUMMARY_ROWS).messages({
  "array.base": "El resumen debe ser una lista de renglones.",
  "array.max": `El resumen no puede tener más de ${MAX_SUMMARY_ROWS} renglones.`,
});

const badges = Joi.array()
  .items(objectId)
  .max(MAX_PRODUCT_BADGES)
  .unique()
  .messages({
    "array.max": `Solo se puede asignar ${MAX_PRODUCT_BADGES} badge por producto.`,
    "array.unique": "Hay badges repetidos.",
  });

/**
 * `compareAtPrice` is the struck-through "precio anterior". It must sit above
 * the real price — a fake discount where the compare price is lower is both a
 * UI bug and, in Mexico, a PROFECO problem.
 */
const compareAtPrice = priceCents.greater(Joi.ref("price")).messages({
  "number.greater": "El precio anterior debe ser mayor al precio actual.",
});

/**
 * Fields shared by both catalogs. Neither `isActive` nor `archivedAt` is ever
 * accepted from a payload — those are server-owned lifecycle state, mutated
 * only through the archive/restore routes. `isNewArrival` is the opposite case and
 * belongs here: it's merchandising curation the admin sets by hand, no
 * different from `badges`.
 */
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
  badges: badges.optional(),
  isNewArrival: Joi.boolean().optional(),
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
  summary: summary.default([]),
  relatedAccessories: relatedAccessories.default([]),
  variants: variantsWithInitialStock.optional(),
});

export const updateBikeSchema = Joi.object({
  ...productBase,
  shortDescription: shortDescription.optional(),
  summary: summary.optional(),
  relatedAccessories: relatedAccessories.optional(),
  variants: variantsWithInitialStock.optional(),
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
  variants: variantsWithInitialStock.optional(),
});

export const updateAccessorySchema = Joi.object({
  ...productBase,
  variants: variantsWithInitialStock.optional(),
})
  .min(1)
  .messages({ "object.min": "Envía al menos un campo para actualizar." });
