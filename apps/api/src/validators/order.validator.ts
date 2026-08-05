import type { OrderStatus } from "@bw-bikes/shared";
import Joi from "joi";
import { MAX_CANCEL_REASON_LENGTH } from "../models/index.js";
import { BULK_ALLOWED_STATUSES } from "../services/order.service.js";
import { ORDER_STATUSES } from "../services/order-state.js";
import { objectId } from "./common.validator.js";
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

const MAX_BULK_ORDER_IDS = 50;

/**
 * `status` is restricted to `BULK_ALLOWED_STATUSES` — the same list
 * `bulkUpdateStatus` enforces in the service — not the full `ORDER_STATUSES`.
 * `shipped` needs a tracking number per order (`recordShipmentSchema` is the
 * only door to it) and `cancelled`/`refunded` move money, neither of which a
 * batch endpoint should do.
 */
export const bulkOrderStatusSchema = Joi.object({
  orderIds: Joi.array()
    .items(objectId.messages({ "string.pattern.base": "Uno de los identificadores no es válido." }))
    .min(1)
    .max(MAX_BULK_ORDER_IDS)
    .required()
    .messages({
      "array.min": "Selecciona al menos una orden.",
      "array.max": `No puedes actualizar más de ${MAX_BULK_ORDER_IDS} órdenes a la vez.`,
      "any.required": "Selecciona al menos una orden.",
    }),
  status: Joi.string()
    .valid(...(BULK_ALLOWED_STATUSES as readonly OrderStatus[]))
    .required()
    .messages({
      "any.only": "Ese estatus no se puede aplicar de forma masiva.",
      "any.required": "El estatus es obligatorio.",
    }),
  reason: Joi.string().trim().max(MAX_CANCEL_REASON_LENGTH).optional(),
});
