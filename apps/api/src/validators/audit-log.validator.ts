import { AUDIT_ACTIONS } from "@bw-bikes/shared";
import Joi from "joi";
import { objectId } from "./common.validator.js";
import { pagination } from "./list-query.validator.js";

/**
 * `GET /admin/audit-logs` (M11, superadmin-only). `action` is validated
 * against `AUDIT_ACTIONS` — the runtime mirror of the `AuditAction` union —
 * rather than accepted as free text, so a typo'd action reads as a clear 400
 * instead of a query that silently matches nothing.
 */
export const auditLogListQuerySchema = Joi.object({
  ...pagination,
  module: Joi.string().trim().max(100).optional(),
  action: Joi.string()
    .valid(...AUDIT_ACTIONS)
    .optional()
    .messages({ "any.only": "La acción indicada no es válida." }),
  actorId: objectId.optional().messages({ "string.pattern.base": "El actor indicado es inválido." }),
  from: Joi.string().isoDate().optional().messages({ "string.isoDate": '"from" debe ser una fecha ISO 8601.' }),
  to: Joi.string().isoDate().optional().messages({ "string.isoDate": '"to" debe ser una fecha ISO 8601.' }),
});
