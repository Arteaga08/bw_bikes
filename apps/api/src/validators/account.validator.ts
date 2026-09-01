import Joi from "joi";

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
