import { Router } from "express";
import { listAdminAuditLogs } from "../controllers/audit-log.controller.js";
import { protect, restrictTo, validate } from "../middlewares/index.js";
import { auditLogListQuerySchema } from "../validators/index.js";

/**
 * Read-only audit trail viewer (M11) — the first route in the codebase
 * restricted to `superadmin` alone, rather than `admin`+`superadmin` like
 * every other admin router. Owner-level visibility into what every admin
 * account (not just this one) has done. No write path exists here on
 * purpose: `AuditLog` is append-only, and `recordAuditLog` is its sole
 * writer (see `audit-log.service.ts`).
 */
const router = Router();

router.use(protect, restrictTo("superadmin"));

router.get("/audit-logs", validate(auditLogListQuerySchema, "query"), listAdminAuditLogs);

export { router as adminAuditLogRouter };
