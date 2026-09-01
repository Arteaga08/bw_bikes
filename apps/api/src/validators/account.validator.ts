import type { ItemType } from "@bw-bikes/shared";
import { GEAR_SIZE_CATEGORIES, MAX_GEAR_SIZES, RIDE_STYLE_VALUES } from "@bw-bikes/shared";
import Joi from "joi";
import { MAX_GEAR_SIZE_VALUE_LENGTH, MAX_HEIGHT_CM, MIN_HEIGHT_CM } from "../models/schemas/fit.schema.js";
import { MAX_LABEL_LENGTH } from "../models/schemas/saved-address.schema.js";
import { billingInfoSchema as cartBillingInfoSchema } from "./billing.validator.js";
import { objectId } from "./common.validator.js";
import { shippingAddressSchema as cartShippingAddressSchema } from "./shipping.validator.js";

const WISHLIST_ITEM_TYPES: ItemType[] = ["bike", "accessory"];

const wishlistItemType = Joi.string()
  .valid(...WISHLIST_ITEM_TYPES)
  .messages({
    "any.only": "El tipo de producto no es válido.",
    "any.required": "El tipo de producto es obligatorio.",
  });

export const updateProfileSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(60).messages({
    "string.min": "El nombre debe tener al menos 2 caracteres.",
    "string.max": "El nombre no puede exceder 60 caracteres.",
  }),
  lastName: Joi.string().trim().min(2).max(60).messages({
    "string.min": "El apellido debe tener al menos 2 caracteres.",
    "string.max": "El apellido no puede exceder 60 caracteres.",
  }),
  phone: Joi.string()
    .trim()
    .pattern(/^\d{10}$/)
    .messages({
      "string.pattern.base": "El teléfono debe tener 10 dígitos.",
    }),
  birthDate: Joi.date().messages({
    "date.base": "Ingresa una fecha de nacimiento válida.",
  }),
  city: Joi.string().trim().max(80).messages({
    "string.max": "La ciudad no puede exceder 80 caracteres.",
  }),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(1).max(72).required().messages({
    "string.empty": "La contraseña actual es obligatoria.",
    "any.required": "La contraseña actual es obligatoria.",
  }),
  newPassword: Joi.string().min(8).max(72).required().messages({
    "string.empty": "La nueva contraseña es obligatoria.",
    "string.min": "La nueva contraseña debe tener al menos 8 caracteres.",
    "string.max": "La nueva contraseña no puede exceder 72 caracteres.",
    "any.required": "La nueva contraseña es obligatoria.",
  }),
});

/** `POST` and `PATCH /account/addresses` — same fields as the cart's shipping address plus `label`, since `AddressForm` submits the whole form on both create and edit. */
export const saveAddressSchema = cartShippingAddressSchema.keys({
  label: Joi.string().trim().min(1).max(MAX_LABEL_LENGTH).required().messages({
    "string.empty": "El nombre de la dirección es obligatorio.",
    "string.max": `El nombre de la dirección no puede exceder ${MAX_LABEL_LENGTH} caracteres.`,
    "any.required": "El nombre de la dirección es obligatorio.",
  }),
});

/** `:addressId` path param, reused by every `/account/addresses/:addressId*` route. */
export const addressIdParamSchema = Joi.object({ addressId: objectId.required() });

/** `PUT /account/billing-info` — identical rules to the cart's own `PUT /cart/billing-info`. */
export const accountBillingInfoSchema = cartBillingInfoSchema;

/** `PUT /account/fit` — full replace of `User.fit` (A4-mis-tallas.md), same pattern as `accountBillingInfoSchema`. */
export const updateFitSchema = Joi.object({
  heightCm: Joi.number().integer().min(MIN_HEIGHT_CM).max(MAX_HEIGHT_CM).messages({
    "number.base": "La estatura debe ser un número.",
    "number.integer": "La estatura debe ser un número entero.",
    "number.min": `La estatura no puede ser menor a ${MIN_HEIGHT_CM} cm.`,
    "number.max": `La estatura no puede ser mayor a ${MAX_HEIGHT_CM} cm.`,
  }),
  rideStyle: Joi.string()
    .valid(...RIDE_STYLE_VALUES)
    .messages({
      "any.only": "El estilo de rodar no es válido.",
    }),
  gearSizes: Joi.array()
    .items(
      Joi.object({
        category: Joi.string()
          .valid(...GEAR_SIZE_CATEGORIES)
          .required()
          .messages({
            "any.only": "La categoría de talla no es válida.",
            "any.required": "La categoría de talla es obligatoria.",
          }),
        value: Joi.string().trim().min(1).max(MAX_GEAR_SIZE_VALUE_LENGTH).required().messages({
          "string.empty": "La talla es obligatoria.",
          "string.max": `La talla no puede exceder ${MAX_GEAR_SIZE_VALUE_LENGTH} caracteres.`,
          "any.required": "La talla es obligatoria.",
        }),
      }),
    )
    .max(MAX_GEAR_SIZES)
    .unique("category")
    .messages({
      "array.max": `No puedes guardar más de ${MAX_GEAR_SIZES} tallas de equipamiento.`,
      "array.unique": "Cada categoría solo puede tener una talla guardada.",
    }),
});

/** `POST /account/wishlist` — what identifies a product to save, nothing else (A5-guardados.md: price/name are never trusted from the client). */
export const addWishlistItemSchema = Joi.object({
  itemType: wishlistItemType.required(),
  itemId: objectId.required().messages({ "string.pattern.base": "El producto es inválido." }),
});

/** `:itemType/:itemId` path params, reused by `DELETE /account/wishlist/:itemType/:itemId`. */
export const wishlistItemParamSchema = Joi.object({
  itemType: wishlistItemType.required(),
  itemId: objectId.required().messages({ "string.pattern.base": "El producto es inválido." }),
});
