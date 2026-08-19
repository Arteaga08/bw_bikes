import Joi from "joi";

/**
 * One schema per `Settings` section, each requiring **every** field of that
 * section — this is a replace, not a patch, matching M3's precedent for
 * `PUT /spec-groups`: one atomic write per logical unit rather than a
 * sub-resource per field. `stripUnknown` (applied by the `validate`
 * middleware) is what guarantees a field from another section in the body
 * never reaches the service, so "shipping" can never accidentally carry
 * "orders" data even if a client sends it.
 */

const positiveInt = (label: string) =>
  Joi.number().integer().min(1).required().messages({
    "number.base": `${label} debe ser un número.`,
    "number.integer": `${label} debe ser un entero.`,
    "number.min": `${label} debe ser mayor a cero.`,
    "any.required": `${label} es obligatorio.`,
  });

const nonNegativeInt = (label: string) =>
  Joi.number().integer().min(0).required().messages({
    "number.base": `${label} debe ser un número.`,
    "number.integer": `${label} debe ser un entero.`,
    "number.min": `${label} no puede ser negativo.`,
    "any.required": `${label} es obligatorio.`,
  });

export const settingsInventorySchema = Joi.object({
  stockReservationTtlMinutes: positiveInt("El TTL de reserva de stock"),
  reservationRetentionDays: positiveInt("Los días de retención de reservas"),
  lowStockThresholdUnits: nonNegativeInt("El umbral de stock bajo"),
});

export const settingsOrdersSchema = Joi.object({
  orderPaymentTtlMinutes: positiveInt("El TTL de pago de la orden"),
  orderAuthAlertHours: positiveInt("Las horas de aviso de autorización"),
  orderAuthCancelHours: positiveInt("Las horas de cancelación de autorización"),
  paymentReconciliationAfterMinutes: positiveInt("Los minutos de gracia de reconciliación"),
  requestThreeDSecure: Joi.string().valid("automatic", "any").required().messages({
    "any.only": 'La política de 3D Secure debe ser "automatic" o "any".',
    "any.required": "La política de 3D Secure es obligatoria.",
  }),
}).custom((value, helpers) => {
  if (value.orderAuthAlertHours >= value.orderAuthCancelHours) {
    return helpers.message({
      custom: "Las horas de aviso deben ser menores a las horas de cancelación.",
    });
  }
  return value;
});

export const settingsPricingSchema = Joi.object({
  taxRateBps: nonNegativeInt("La tasa de IVA en puntos base"),
});

export const settingsShippingSchema = Joi.object({
  accessoryFlatCents: nonNegativeInt("La tarifa plana de envío"),
  freeShippingThresholdCents: nonNegativeInt("El umbral de envío gratis"),
});

export const settingsApplicationsSchema = Joi.object({
  cooldownDays: nonNegativeInt("Los días de espera para reaplicar"),
});

const MIN_JOB_INTERVAL_MS = 1_000;

const jobIntervalMs = (label: string) =>
  Joi.number().integer().min(MIN_JOB_INTERVAL_MS).required().messages({
    "number.base": `${label} debe ser un número.`,
    "number.integer": `${label} debe ser un entero.`,
    "number.min": `${label} debe ser de al menos ${MIN_JOB_INTERVAL_MS}ms.`,
    "any.required": `${label} es obligatorio.`,
  });

export const settingsJobsSchema = Joi.object({
  reservationReaperIntervalMs: jobIntervalMs("El intervalo del reaper de reservas"),
  orderAuthSweepIntervalMs: jobIntervalMs("El intervalo del barrido de autorizaciones"),
  paymentReconciliationIntervalMs: jobIntervalMs("El intervalo de reconciliación de pagos"),
  lowStockAlertIntervalMs: jobIntervalMs("El intervalo del barrido de stock bajo"),
});
