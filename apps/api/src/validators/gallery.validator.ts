import Joi from "joi";
import { MAX_IMAGE_ALT_LENGTH } from "../models/index.js";

/**
 * Text fields that ride along with a `multipart/form-data` upload.
 *
 * Note these arrive **after** the global `sanitizeInput` middleware has
 * already run and found nothing — that middleware sits behind
 * `express.json()` and never sees multipart fields. The gallery route
 * therefore sanitizes explicitly after `validate`, per the note in
 * `middlewares/sanitize-input.ts` and BACKEND_SECURITY_GUIDELINES.md §5.
 */
export const uploadGalleryImagesSchema = Joi.object({
  alt: Joi.string().trim().max(MAX_IMAGE_ALT_LENGTH).allow("").optional().messages({
    "string.max": `El texto alternativo no puede exceder ${MAX_IMAGE_ALT_LENGTH} caracteres.`,
  }),
});

/**
 * A Cloudinary `publicId` contains slashes (`bw-bikes/bikes/tarmac-abc123`),
 * so it can't ride as a plain path segment without being escaped by the
 * client. It travels in the body of the DELETE instead.
 */
export const deleteGalleryImageSchema = Joi.object({
  publicId: Joi.string()
    .trim()
    .max(200)
    .pattern(/^[A-Za-z0-9/_-]+$/)
    .required()
    .messages({
      "string.empty": "El identificador de la imagen es obligatorio.",
      "string.pattern.base": "Identificador de imagen inválido.",
      "any.required": "El identificador de la imagen es obligatorio.",
    }),
});

/** Reordering the gallery is a plain list of publicIds in their new order. */
export const reorderGallerySchema = Joi.object({
  publicIds: Joi.array()
    .items(Joi.string().trim().max(200))
    .min(1)
    .unique()
    .required()
    .messages({
      "array.min": "Envía al menos una imagen.",
      "array.unique": "Hay imágenes repetidas en el orden enviado.",
      "any.required": "El orden de la galería es obligatorio.",
    }),
});
