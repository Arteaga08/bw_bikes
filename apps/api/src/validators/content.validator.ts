import {
  HERO_CTA_TARGET_TYPES,
  HERO_FOCAL_POINTS,
  MAX_HERO_CTA_LABEL_LENGTH,
  MAX_HERO_CTA_URL_LENGTH,
  MAX_HERO_CTAS_PER_SLIDE,
  MAX_HERO_EYEBROW_LENGTH,
  MAX_HERO_SLIDES,
  MAX_HERO_SUBTITLE_LENGTH,
  MAX_HERO_TITLE_LENGTH,
} from "@bw-bikes/shared";
import Joi from "joi";
import { objectId } from "./common.validator.js";

/**
 * A CTA's `target` is a discriminated union on `type`: the four catalog
 * kinds require `refId` and forbid `url`, `"url"` requires `url` and forbids
 * `refId`. `Joi.when` encodes that so a client can't send both or neither
 * and have the service silently pick one.
 *
 * `url` is restricted to internal paths (`/algo`) — a hero CTA is
 * merchandising, not a generic link field, and accepting `http(s)://`
 * here would turn the hero into an open redirect surface.
 */
const heroCtaTargetSchema = Joi.object({
  type: Joi.string()
    .valid(...HERO_CTA_TARGET_TYPES)
    .required()
    .messages({
      "any.only": "Tipo de destino inválido.",
      "any.required": "El tipo de destino es obligatorio.",
    }),
  refId: Joi.when("type", {
    is: "url",
    then: Joi.forbidden(),
    otherwise: objectId.required(),
  }),
  url: Joi.when("type", {
    is: "url",
    then: Joi.string()
      .trim()
      .max(MAX_HERO_CTA_URL_LENGTH)
      .pattern(/^\/[A-Za-z0-9/_\-?=&]*$/)
      .required()
      .messages({
        "string.pattern.base": "La URL debe ser una ruta interna que empiece con \"/\".",
        "any.required": "La URL es obligatoria.",
      }),
    otherwise: Joi.forbidden(),
  }),
});

const heroCtaSchema = Joi.object({
  label: Joi.string().trim().max(MAX_HERO_CTA_LABEL_LENGTH).required().messages({
    "string.empty": "El texto del botón es obligatorio.",
    "string.max": `El texto del botón no puede exceder ${MAX_HERO_CTA_LABEL_LENGTH} caracteres.`,
    "any.required": "El texto del botón es obligatorio.",
  }),
  target: heroCtaTargetSchema.required(),
});

/**
 * Full replace, same contract as every `Settings` section — every field
 * required, `stripUnknown` (applied by the `validate` middleware) drops
 * anything else. The image itself never rides this body: it travels through
 * the dedicated multipart upload endpoint, same split as
 * `admin-catalog.route.ts`'s category image.
 */
export const heroSlideSchema = Joi.object({
  focalPoint: Joi.string()
    .valid(...HERO_FOCAL_POINTS)
    .required()
    .messages({
      "any.only": "Punto focal inválido.",
      "any.required": "El punto focal es obligatorio.",
    }),
  eyebrow: Joi.string().trim().max(MAX_HERO_EYEBROW_LENGTH).allow("").optional().messages({
    "string.max": `El eyebrow no puede exceder ${MAX_HERO_EYEBROW_LENGTH} caracteres.`,
  }),
  title: Joi.string().trim().max(MAX_HERO_TITLE_LENGTH).required().messages({
    "string.empty": "El título es obligatorio.",
    "string.max": `El título no puede exceder ${MAX_HERO_TITLE_LENGTH} caracteres.`,
    "any.required": "El título es obligatorio.",
  }),
  subtitle: Joi.string().trim().max(MAX_HERO_SUBTITLE_LENGTH).allow("").optional().messages({
    "string.max": `El subtítulo no puede exceder ${MAX_HERO_SUBTITLE_LENGTH} caracteres.`,
  }),
  ctas: Joi.array().items(heroCtaSchema).min(1).max(MAX_HERO_CTAS_PER_SLIDE).required().messages({
    "array.min": "Cada slide necesita al menos un botón.",
    "array.max": `Cada slide admite como máximo ${MAX_HERO_CTAS_PER_SLIDE} botones.`,
    "any.required": "Los botones son obligatorios.",
  }),
  isActive: Joi.boolean().required().messages({
    "any.required": "El estado activo es obligatorio.",
  }),
});

/**
 * The full, ordered list of slide ids — a partial list would leave the
 * omitted slides at stale positions (see `hero-slide.service.ts`'s
 * `reorder`), so the shape itself asks for a complete sequence.
 */
export const reorderHeroSlidesSchema = Joi.object({
  ids: Joi.array().items(objectId.required()).min(1).max(MAX_HERO_SLIDES).required().messages({
    "array.min": "El orden no puede estar vacío.",
    "array.max": `El orden no puede tener más de ${MAX_HERO_SLIDES} slides.`,
    "any.required": "El orden es obligatorio.",
  }),
});

/** Text field riding alongside the multipart image upload — mirrors `uploadGalleryImagesSchema`'s reasoning for why this is a separate, tiny schema. */
export const heroSlideImageSchema = Joi.object({
  alt: Joi.string().trim().max(160).allow("").optional().messages({
    "string.max": "El texto alternativo no puede exceder 160 caracteres.",
  }),
});
