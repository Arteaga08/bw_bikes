import type { CfdiUse, TaxRegime } from "@bw-bikes/shared";
import { CFDI_USES, TAX_REGIMES } from "@bw-bikes/shared";
import Joi from "joi";

/**
 * `PUT /cart/billing-info` (M7). Optional CFDI data, captured ahead of
 * checkout — see `models/schemas/billing-info.schema.ts`. Every field here
 * is `required()` **within this schema**: a partial fiscal record is worse
 * than none, since a future invoicing milestone would have to detect and
 * reject it instead of trusting whatever the cart holds. What stays optional
 * is the endpoint itself — a customer who never calls it checks out with no
 * `billingInfo` at all.
 */

/** 12 chars for a moral person (empresa), 13 for a physical one (persona física). SAT's own two lengths. */
const RFC_PATTERN = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

export const billingInfoSchema = Joi.object({
  rfc: Joi.string().trim().uppercase().pattern(RFC_PATTERN).required().messages({
    "string.empty": "El RFC es obligatorio.",
    "string.pattern.base": "El RFC no tiene un formato válido.",
    "any.required": "El RFC es obligatorio.",
  }),
  legalName: Joi.string().trim().min(3).max(150).required().messages({
    "string.empty": "La razón social es obligatoria.",
    "string.min": "La razón social es demasiado corta.",
    "string.max": "La razón social no puede exceder 150 caracteres.",
    "any.required": "La razón social es obligatoria.",
  }),
  cfdiUse: Joi.string()
    .valid(...(CFDI_USES as readonly CfdiUse[]))
    .required()
    .messages({
      "any.only": "El uso de CFDI no es válido.",
      "any.required": "El uso de CFDI es obligatorio.",
    }),
  taxRegime: Joi.string()
    .valid(...(TAX_REGIMES as readonly TaxRegime[]))
    .required()
    .messages({
      "any.only": "El régimen fiscal no es válido.",
      "any.required": "El régimen fiscal es obligatorio.",
    }),
  postalCode: Joi.string()
    .trim()
    .pattern(/^\d{5}$/)
    .required()
    .messages({
      "string.empty": "El código postal es obligatorio.",
      "string.pattern.base": "El código postal debe tener 5 dígitos.",
      "any.required": "El código postal es obligatorio.",
    }),
});
