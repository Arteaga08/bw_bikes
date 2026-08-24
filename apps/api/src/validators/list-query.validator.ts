import Joi from "joi";
import { MAX_PAGE } from "../utils/list-query.js";
import { objectId, priceCents } from "./common.validator.js";

/**
 * Query-string schemas for list endpoints. Running these through
 * `validate(schema, "query")` does two things `parseListQuery` deliberately
 * doesn't: it **whitelists** which filters exist at all (`stripUnknown` drops
 * the rest, so no client-supplied key ever reaches a Mongo filter object), and
 * it coerces `"2"` into `2` and `"true"` into `true` before the service reads
 * them.
 */

/** Exported so every list endpoint — catalog or not — spreads the same four params. */
export const pagination = {
  page: Joi.number().integer().min(1).max(MAX_PAGE).optional().messages({
    "number.base": 'El parámetro "page" debe ser un número.',
    "number.min": 'El parámetro "page" debe ser mayor a cero.',
    "number.max": `El parámetro "page" no puede exceder ${MAX_PAGE}.`,
  }),
  limit: Joi.number().integer().min(1).optional().messages({
    "number.base": 'El parámetro "limit" debe ser un número.',
    "number.min": 'El parámetro "limit" debe ser mayor a cero.',
  }),
  // Validated against the per-endpoint whitelist in `parseListQuery`, which is
  // where the list of sortable fields actually lives.
  sort: Joi.string().trim().max(40).optional(),
  search: Joi.string().trim().max(80).allow("").optional(),
};

export const categoryListQuerySchema = Joi.object({
  ...pagination,
  parent: objectId.allow("null", null).optional(),
  isActive: Joi.boolean().optional(),
});

/**
 * A flat, non-hierarchical list scoped only by pagination/search/isActive —
 * shared by every catalog-adjacent resource that isn't a tree: brands,
 * badges, spec templates. `brandListQuerySchema`/`badgeListQuerySchema` are
 * the same object under two names so each route file reads naturally about
 * the resource it's validating, without three near-identical schemas to keep
 * in sync.
 */
export const flatCatalogListQuerySchema = Joi.object({
  ...pagination,
  isActive: Joi.boolean().optional(),
});

export const brandListQuerySchema = flatCatalogListQuerySchema;
export const badgeListQuerySchema = flatCatalogListQuerySchema;
export const specTemplateListQuerySchema = flatCatalogListQuerySchema;
export const sizeTemplateListQuerySchema = flatCatalogListQuerySchema;
export const colorTemplateListQuerySchema = flatCatalogListQuerySchema;

/** Shared by both product catalogs; `isActive` is admin-only (public lists force it to true). */
const productFilters = {
  ...pagination,
  category: objectId.optional().messages({ "string.pattern.base": "La categoría es inválida." }),
  brand: Joi.string().trim().max(60).optional(),
  minPrice: priceCents.optional(),
  maxPrice: priceCents.optional(),
};

export const publicProductListQuerySchema = Joi.object({
  ...productFilters,
  size: Joi.string().trim().max(16).optional(),
  color: Joi.string().trim().max(40).optional(),
});

export const adminProductListQuerySchema = Joi.object({
  ...productFilters,
  size: Joi.string().trim().max(16).optional(),
  color: Joi.string().trim().max(40).optional(),
  isActive: Joi.boolean().optional(),
});
