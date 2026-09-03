import type { Carrier, MexicanState } from "@bw-bikes/shared";
import { MEXICAN_STATES } from "@bw-bikes/shared";
import Joi from "joi";
import { NO_HTML_MESSAGE, NO_HTML_PATTERN } from "./common.validator.js";

/** Shared by the cart's `PUT /shipping-address` and, later, checkout previews. */
export const shippingAddressSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(60).pattern(NO_HTML_PATTERN).required().messages({
    "string.empty": "El nombre es obligatorio.",
    "string.min": "El nombre es demasiado corto.",
    "string.max": "El nombre no puede exceder 60 caracteres.",
    "string.pattern.base": NO_HTML_MESSAGE,
    "any.required": "El nombre es obligatorio.",
  }),
  lastName: Joi.string().trim().min(2).max(60).pattern(NO_HTML_PATTERN).required().messages({
    "string.empty": "El apellido es obligatorio.",
    "string.min": "El apellido es demasiado corto.",
    "string.max": "El apellido no puede exceder 60 caracteres.",
    "string.pattern.base": NO_HTML_MESSAGE,
    "any.required": "El apellido es obligatorio.",
  }),
  phone: Joi.string()
    .trim()
    .pattern(/^\d{10}$/)
    .required()
    .messages({
      "string.empty": "El teléfono es obligatorio.",
      "string.pattern.base": "El teléfono debe tener 10 dígitos.",
      "any.required": "El teléfono es obligatorio.",
    }),
  street: Joi.string().trim().min(3).max(120).pattern(NO_HTML_PATTERN).required().messages({
    "string.empty": "La calle es obligatoria.",
    "string.max": "La calle no puede exceder 120 caracteres.",
    "string.pattern.base": NO_HTML_MESSAGE,
    "any.required": "La calle es obligatoria.",
  }),
  interiorNumber: Joi.string().trim().max(30).optional().allow(""),
  neighborhood: Joi.string().trim().min(2).max(120).pattern(NO_HTML_PATTERN).required().messages({
    "string.empty": "La colonia es obligatoria.",
    "string.max": "La colonia no puede exceder 120 caracteres.",
    "string.pattern.base": NO_HTML_MESSAGE,
    "any.required": "La colonia es obligatoria.",
  }),
  city: Joi.string().trim().min(2).max(120).pattern(NO_HTML_PATTERN).required().messages({
    "string.empty": "La ciudad es obligatoria.",
    "string.max": "La ciudad no puede exceder 120 caracteres.",
    "string.pattern.base": NO_HTML_MESSAGE,
    "any.required": "La ciudad es obligatoria.",
  }),
  state: Joi.string()
    .valid(...(MEXICAN_STATES as readonly MexicanState[]))
    .required()
    .messages({
      "any.only": "El estado no es válido.",
      "any.required": "El estado es obligatorio.",
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
  country: Joi.string().valid("MX").default("MX"),
  references: Joi.string().trim().max(250).pattern(NO_HTML_PATTERN).optional().allow("").messages({
    "string.max": "Las referencias no pueden exceder 250 caracteres.",
    "string.pattern.base": NO_HTML_MESSAGE,
  }),
});

const CARRIERS: Carrier[] = ["dhl", "fedex", "estafeta", "paquetexpress", "redpack", "ups", "otro"];

/**
 * Captures or corrects a shipment's tracking facts. `carrierName` and
 * `trackingUrl` become required only for `carrier: "otro"` — every listed
 * carrier gets its tracking URL built from the number by
 * `shippingService.buildTrackingUrl`, but an unlisted one has no template to
 * build from.
 */
export const recordShipmentSchema = Joi.object({
  carrier: Joi.string()
    .valid(...CARRIERS)
    .required()
    .messages({
      "any.only": "La paquetería no es válida.",
      "any.required": "La paquetería es obligatoria.",
    }),
  carrierName: Joi.string()
    .trim()
    .max(80)
    .when("carrier", { is: "otro", then: Joi.required(), otherwise: Joi.optional() })
    .messages({ "any.required": "Indica el nombre de la paquetería." }),
  trackingNumber: Joi.string().trim().min(3).max(60).required().messages({
    "string.empty": "El número de guía es obligatorio.",
    "any.required": "El número de guía es obligatorio.",
  }),
  trackingUrl: Joi.string()
    .trim()
    .uri({ scheme: ["https"] })
    .when("carrier", { is: "otro", then: Joi.required(), otherwise: Joi.optional() })
    .messages({
      "string.uri": "La URL de rastreo debe ser https.",
      "any.required": "Indica la URL de rastreo para esta paquetería.",
    }),
});
