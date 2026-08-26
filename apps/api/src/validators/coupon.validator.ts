import type { CouponScopeKind, CouponType, ItemType } from "@bw-bikes/shared";
import Joi from "joi";
import { COUPON_CODE_PATTERN, MAX_COUPON_CODE_LENGTH, MAX_COUPON_NAME_LENGTH, MAX_PERCENT_OFF_BPS } from "../models/index.js";
import { objectId, priceCents } from "./common.validator.js";

const COUPON_TYPES: CouponType[] = ["percent_off", "amount_off"];
const COUPON_SCOPE_KINDS: CouponScopeKind[] = ["all", "bikes", "accessories", "categories"];
const ITEM_TYPES: ItemType[] = ["bike", "accessory"];

const code = Joi.string()
  .trim()
  .uppercase()
  .min(3)
  .max(MAX_COUPON_CODE_LENGTH)
  .pattern(COUPON_CODE_PATTERN)
  .messages({
    "string.empty": "El código es obligatorio.",
    "string.min": "El código debe tener al menos 3 caracteres.",
    "string.max": `El código no puede exceder ${MAX_COUPON_CODE_LENGTH} caracteres.`,
    "string.pattern.base": "El código solo puede contener letras mayúsculas, números y guiones.",
    "any.required": "El código es obligatorio.",
  });

const name = Joi.string().trim().min(1).max(MAX_COUPON_NAME_LENGTH).messages({
  "string.empty": "El nombre de la campaña es obligatorio.",
  "string.max": `El nombre no puede exceder ${MAX_COUPON_NAME_LENGTH} caracteres.`,
  "any.required": "El nombre de la campaña es obligatorio.",
});

const type = Joi.string()
  .valid(...COUPON_TYPES)
  .messages({
    "any.only": "El tipo de cupón no es válido.",
    "any.required": "El tipo de cupón es obligatorio.",
  });

const percentOffBps = Joi.number().integer().min(1).max(MAX_PERCENT_OFF_BPS).messages({
  "number.base": "El porcentaje debe ser un número.",
  "number.integer": "El porcentaje debe expresarse en puntos base enteros.",
  "number.min": "El porcentaje debe ser mayor a cero.",
  "number.max": "El porcentaje no puede exceder 100%.",
});

/**
 * A redemption limit of zero is not a limit, it is a deactivated campaign —
 * and `isActive: false` already says that unambiguously. Both caps start at 1.
 */
const redemptionLimit = (label: string) =>
  Joi.number().integer().min(1).max(1_000_000).messages({
    "number.base": `${label} debe ser un número.`,
    "number.integer": `${label} debe ser un número entero.`,
    "number.min": `${label} debe ser al menos 1.`,
    "number.max": `${label} es demasiado alto.`,
  });

const scope = Joi.object({
  kind: Joi.string()
    .valid(...COUPON_SCOPE_KINDS)
    .required()
    .messages({ "any.only": "El alcance del cupón no es válido.", "any.required": "El alcance es obligatorio." }),
  categoryIds: Joi.array().items(objectId).min(1).max(50).optional().messages({
    "array.min": "Selecciona al menos una categoría.",
    "array.max": "No puedes seleccionar más de 50 categorías.",
  }),
  itemType: Joi.string()
    .valid(...ITEM_TYPES)
    .optional()
    .messages({ "any.only": "El tipo de producto no es válido." }),
})
  // Bikes and accessories have two independent category trees, so an id list
  // without an `itemType` doesn't say which collection to resolve against —
  // and would silently match nothing rather than failing loudly.
  .when(Joi.object({ kind: Joi.valid("categories") }).unknown(), {
    then: Joi.object({
      categoryIds: Joi.required(),
      itemType: Joi.required(),
    }).messages({
      "any.required": "Un cupón limitado a categorías requiere las categorías y el tipo de producto.",
    }),
  });

/**
 * The percent/amount exclusivity, stated three times on purpose.
 *
 * `xor` gives the admin a precise message. The `when` blocks below make the
 * value match the declared `type`, so a `percent_off` coupon carrying an
 * `amountOffCents` is rejected instead of quietly ignored. The model's
 * `pre("validate")` hook then catches every writer that never passes through
 * here — a script, a campaign generator, a future import.
 */
const discountRules = {
  percentOffBps: percentOffBps.optional(),
  amountOffCents: priceCents.optional(),
  maxDiscountCents: priceCents.optional(),
};

export const createCouponSchema = Joi.object({
  code: code.required(),
  name: name.required(),
  type: type.required(),
  ...discountRules,
  minSubtotalCents: priceCents.optional(),
  scope: scope.default({ kind: "all" }),
  startsAt: Joi.date().iso().optional().messages({ "date.format": "La fecha de inicio no es válida." }),
  expiresAt: Joi.date().iso().greater(Joi.ref("startsAt")).optional().messages({
    "date.format": "La fecha de expiración no es válida.",
    "date.greater": "La fecha de expiración debe ser posterior a la de inicio.",
  }),
  maxRedemptionsTotal: redemptionLimit("El límite total de canjes").optional(),
  maxRedemptionsPerCustomer: redemptionLimit("El límite de canjes por cliente").default(1),
  isActive: Joi.boolean().default(true),
})
  .xor("percentOffBps", "amountOffCents")
  .messages({
    "object.xor": "Define un porcentaje o un monto fijo, no ambos.",
    "object.missing": "Define un porcentaje o un monto fijo.",
  })
  .when(Joi.object({ type: Joi.valid("percent_off") }).unknown(), {
    then: Joi.object({ percentOffBps: Joi.required(), amountOffCents: Joi.forbidden() }),
  })
  .when(Joi.object({ type: Joi.valid("amount_off") }).unknown(), {
    // A ceiling on a fixed amount would be a second, contradictory way of
    // stating the same number.
    then: Joi.object({
      amountOffCents: Joi.required(),
      percentOffBps: Joi.forbidden(),
      maxDiscountCents: Joi.forbidden(),
    }),
  });

export const updateCouponSchema = Joi.object({
  code: code.optional(),
  name: name.optional(),
  type: type.optional(),
  ...discountRules,
  minSubtotalCents: priceCents.optional(),
  scope: scope.optional(),
  startsAt: Joi.date().iso().optional(),
  expiresAt: Joi.date().iso().optional(),
  maxRedemptionsTotal: redemptionLimit("El límite total de canjes").optional(),
  maxRedemptionsPerCustomer: redemptionLimit("El límite de canjes por cliente").optional(),
  isActive: Joi.boolean().optional(),
})
  // `oxor`, not `xor`: an update that only flips `isActive` sends neither
  // discount field, and that is a legitimate patch — but sending both is
  // still a contradiction.
  .oxor("percentOffBps", "amountOffCents")
  .min(1)
  .messages({
    "object.min": "Envía al menos un campo para actualizar.",
    "object.oxor": "Define un porcentaje o un monto fijo, no ambos.",
  });

export const couponListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).optional(),
  sort: Joi.string().trim().max(40).optional(),
  search: Joi.string().trim().max(80).allow("").optional(),
  isActive: Joi.boolean().optional(),
});

/**
 * What a customer sends to `POST /cart/coupon`.
 *
 * Only the code — the discount is decided server-side, the same rule that
 * keeps every price out of the cart's request bodies.
 */
export const applyCouponSchema = Joi.object({
  code: code.required(),
});

/** How long a note an admin may attach to a coupon email. Plain text — see `coupon-campaign.service.ts`. */
export const MAX_COUPON_MESSAGE_LENGTH = 600;

const couponMessage = Joi.string().trim().max(MAX_COUPON_MESSAGE_LENGTH).allow("").optional().messages({
  "string.max": `El mensaje no puede exceder ${MAX_COUPON_MESSAGE_LENGTH} caracteres.`,
});

/**
 * `POST /admin/coupons/:id/send` — one existing campaign, many customers.
 *
 * The cap mirrors `couponCampaignService.MAX_RECIPIENTS`: the send is a serial
 * loop, and an unbounded list would hold a request open for as long as the
 * mail provider takes to answer that many times.
 */
export const sendCouponSchema = Joi.object({
  userIds: Joi.array().items(objectId).min(1).max(200).required().messages({
    "array.min": "Selecciona al menos un cliente.",
    "array.max": "No puedes enviar a más de 200 clientes a la vez.",
    "any.required": "Selecciona al menos un cliente.",
  }),
  message: couponMessage,
});

/**
 * `POST /admin/customers/:id/coupons` — mint a one-off code for this customer
 * and email it. Same discount rules as creating a campaign, minus everything
 * that only makes sense for a shared code (its own name, redemption limits,
 * scope): the service pins those.
 */
export const generateCouponForCustomerSchema = Joi.object({
  type: type.required(),
  ...discountRules,
  minSubtotalCents: priceCents.optional(),
  expiresAt: Joi.date().iso().optional().messages({ "date.format": "La fecha de expiración no es válida." }),
  message: couponMessage,
})
  .xor("percentOffBps", "amountOffCents")
  .messages({
    "object.xor": "Define un porcentaje o un monto fijo, no ambos.",
    "object.missing": "Define un porcentaje o un monto fijo.",
  });
