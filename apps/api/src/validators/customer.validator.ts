import Joi from "joi";
import { pagination } from "./list-query.validator.js";

/**
 * The customer list's filters.
 *
 * `repeatBuyersOnly` is the segment the shop actually asked for — "quién ha
 * comprado más de una vez" — and it is a boolean rather than a free-form
 * `minOrders` because a threshold nobody uses is a query shape nobody
 * indexed for.
 */
export const customerListQuerySchema = Joi.object({
  ...pagination,
  repeatBuyersOnly: Joi.boolean().optional(),
  buyersOnly: Joi.boolean().optional(),
});
