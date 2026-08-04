import type { OrderStatus } from "@bw-bikes/shared";
import Joi from "joi";
import { MAX_CANCEL_REASON_LENGTH } from "../models/index.js";
import { ORDER_STATUSES } from "../services/order-state.js";
import { pagination } from "./list-query.validator.js";

const status = Joi.string()
  .valid(...(ORDER_STATUSES as readonly OrderStatus[]))
  .messages({ "any.only": "El estatus de orden no es válido." });

/**
 * Checkout takes **no body at all**.
 *
 * The lines come from the customer's own cart and the amounts from the
 * catalog. An empty schema plus Joi's `stripUnknown` means a client that tries
 * to send `{ totalCents: 1 }` has that key removed before any code sees it —
 * the guarantee is structural, not a check someone has to remember.
 *
 * The idempotency key travels in the `Idempotency-Key` header instead, the way
 * payment gateways themselves accept it.
 */
export const createOrderSchema = Joi.object({});

export const orderListQuerySchema = Joi.object({
  ...pagination,
  status: status.optional(),
});

export const adminOrderListQuerySchema = Joi.object({
  ...pagination,
  status: status.optional(),
  orderNumber: Joi.string().trim().uppercase().max(40).optional(),
});

/**
 * Rejecting a supplier order **requires** a reason. The customer is about to
 * be told their purchase fell through; "no motivo" is not an acceptable
 * explanation, and the reason is what the audit entry records.
 */
export const rejectSupplierStockSchema = Joi.object({
  reason: Joi.string()
    .trim()
    .min(5)
    .max(MAX_CANCEL_REASON_LENGTH)
    .required()
    .messages({
      "string.empty": "El motivo del rechazo es obligatorio.",
      "string.min": "El motivo debe tener al menos 5 caracteres.",
      "string.max": `El motivo no puede exceder ${MAX_CANCEL_REASON_LENGTH} caracteres.`,
      "any.required": "El motivo del rechazo es obligatorio.",
    }),
});
