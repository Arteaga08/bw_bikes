import Joi from "joi";

// Shared field schemas, so every schema below agrees on shape + message copy.
const email = Joi.string().trim().lowercase().email().required().messages({
  "string.empty": "El correo es obligatorio.",
  "string.email": "Ingresa un correo válido.",
  "any.required": "El correo es obligatorio.",
});

const newPassword = Joi.string().min(8).max(72).required().messages({
  "string.empty": "La contraseña es obligatoria.",
  "string.min": "La contraseña debe tener al menos 8 caracteres.",
  "string.max": "La contraseña no puede exceder 72 caracteres.",
  "any.required": "La contraseña es obligatoria.",
});

const passwordConfirm = Joi.string().valid(Joi.ref("password")).required().messages({
  "any.only": "Las contraseñas no coinciden.",
  "any.required": "Confirma tu contraseña.",
});

// Login intentionally doesn't enforce the 8-char minimum here: a too-short
// password should fail with the same generic "Email o contraseña
// incorrectos" the service already gives a wrong-but-valid-length one, not
// a validation-specific message that behaves differently by input shape.
const currentPassword = Joi.string().min(1).max(72).required().messages({
  "string.empty": "La contraseña es obligatoria.",
  "any.required": "La contraseña es obligatoria.",
});

const name = (label: string) =>
  Joi.string().trim().min(2).max(60).required().messages({
    "string.empty": `${label} es obligatorio.`,
    "string.min": `${label} debe tener al menos 2 caracteres.`,
    "string.max": `${label} no puede exceder 60 caracteres.`,
    "any.required": `${label} es obligatorio.`,
  });

// Our own tokens (email verification, password reset) are always a 64-char
// hex string — see `generateToken()` in utils/crypto.ts (32 random bytes).
const opaqueToken = Joi.string()
  .trim()
  .pattern(/^[a-f0-9]{64}$/)
  .required()
  .messages({
    "string.empty": "El token es obligatorio.",
    "string.pattern.base": "Token inválido.",
    "any.required": "El token es obligatorio.",
  });

const totpCode = Joi.string()
  .trim()
  .pattern(/^\d{6}$/)
  .required()
  .messages({
    "string.empty": "El código es obligatorio.",
    "string.pattern.base": "El código debe tener 6 dígitos.",
    "any.required": "El código es obligatorio.",
  });

export const registerSchema = Joi.object({
  email,
  password: newPassword,
  passwordConfirm,
  firstName: name("El nombre"),
  lastName: name("El apellido"),
});

export const loginSchema = Joi.object({
  email,
  password: currentPassword,
});

export const verifyEmailSchema = Joi.object({ token: opaqueToken });

export const resendVerificationSchema = Joi.object({ email });

export const twoFactorCodeSchema = Joi.object({ totpCode });

export const forgotPasswordSchema = Joi.object({ email });

export const resetPasswordSchema = Joi.object({
  token: opaqueToken,
  password: newPassword,
  passwordConfirm,
});
