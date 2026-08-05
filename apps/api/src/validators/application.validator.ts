import Joi from "joi";
import { MAX_REJECTION_REASON_LENGTH } from "../models/index.js";
import { pagination } from "./list-query.validator.js";

/**
 * These fields arrive as `multipart/form-data` (the routes carry attachments),
 * so every value lands as a string — Joi's default `convert: true` is what
 * turns `"1200"` into a real number for `followersApprox`/`expectedAttendees`
 * and a real `Date` for `eventDate`.
 */

export const ambassadorApplicationSchema = Joi.object({
  discipline: Joi.string().trim().min(2).max(150).required().messages({
    "string.empty": "La disciplina es obligatoria.",
    "any.required": "La disciplina es obligatoria.",
  }),
  city: Joi.string().trim().min(2).max(150).required().messages({
    "string.empty": "La ciudad es obligatoria.",
    "any.required": "La ciudad es obligatoria.",
  }),
  socialMediaHandle: Joi.string().trim().min(2).max(150).required().messages({
    "string.empty": "La red social es obligatoria.",
    "any.required": "La red social es obligatoria.",
  }),
  followersApprox: Joi.number().integer().min(0).required().messages({
    "number.base": "Los seguidores aproximados deben ser un número.",
    "number.integer": "Los seguidores aproximados deben ser un número entero.",
    "number.min": "Los seguidores aproximados no pueden ser negativos.",
    "any.required": "Los seguidores aproximados son obligatorios.",
  }),
  motivation: Joi.string().trim().min(10).max(1000).required().messages({
    "string.min": "Cuéntanos un poco más sobre tu motivación (mínimo 10 caracteres).",
    "any.required": "La motivación es obligatoria.",
  }),
});

export const sponsorshipApplicationSchema = Joi.object({
  eventName: Joi.string().trim().min(2).max(150).required().messages({
    "string.empty": "El nombre del evento es obligatorio.",
    "any.required": "El nombre del evento es obligatorio.",
  }),
  eventDate: Joi.date().iso().required().messages({
    "date.base": "La fecha del evento no es válida.",
    "any.required": "La fecha del evento es obligatoria.",
  }),
  venue: Joi.string().trim().min(2).max(150).required().messages({
    "string.empty": "La sede es obligatoria.",
    "any.required": "La sede es obligatoria.",
  }),
  expectedAttendees: Joi.number().integer().min(1).required().messages({
    "number.base": "El número de asistentes esperados debe ser un número.",
    "number.integer": "El número de asistentes esperados debe ser un número entero.",
    "number.min": "Debe esperarse al menos un asistente.",
    "any.required": "El número de asistentes esperados es obligatorio.",
  }),
  supportRequested: Joi.string().trim().min(10).max(1000).required().messages({
    "string.min": "Describe el apoyo solicitado con un poco más de detalle (mínimo 10 caracteres).",
    "any.required": "El apoyo solicitado es obligatorio.",
  }),
});

/** Rejecting an application **requires** a reason — the applicant is about to be told no. */
export const rejectApplicationSchema = Joi.object({
  reason: Joi.string()
    .trim()
    .min(5)
    .max(MAX_REJECTION_REASON_LENGTH)
    .required()
    .messages({
      "string.empty": "El motivo del rechazo es obligatorio.",
      "string.min": "El motivo debe tener al menos 5 caracteres.",
      "string.max": `El motivo no puede exceder ${MAX_REJECTION_REASON_LENGTH} caracteres.`,
      "any.required": "El motivo del rechazo es obligatorio.",
    }),
});

export const adminApplicationListQuerySchema = Joi.object({
  ...pagination,
  status: Joi.string().valid("pending", "approved", "rejected").optional().messages({
    "any.only": "El estatus no es válido.",
  }),
  type: Joi.string().valid("ambassador", "event_sponsorship").optional().messages({
    "any.only": "El tipo de solicitud no es válido.",
  }),
});
