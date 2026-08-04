import { Router } from "express";
import {
  confirmSupplierStock,
  getOrderForAdmin,
  listOrdersForAdmin,
  rejectSupplierStock,
} from "../controllers/order.controller.js";
import { protect, restrictTo, validate } from "../middlewares/index.js";
import { adminOrderListQuerySchema, idParamSchema, rejectSupplierStockSchema } from "../validators/index.js";

/**
 * The supplier-confirmation queue — the operational heart of the made-to-order
 * mechanism. Confirming captures money that is currently only held; rejecting
 * drops the hold so the customer is never charged.
 *
 * `protect` + `restrictTo` on the whole router, and no rate limit: per
 * BACKEND_SECURITY_GUIDELINES.md §7 the barrier on admin routes is
 * authentication plus role — and an admin session already carries mandatory
 * TOTP 2FA, re-checked on every request.
 */
const router = Router();

router.use(protect, restrictTo("admin", "superadmin"));

router.get("/orders", validate(adminOrderListQuerySchema, "query"), listOrdersForAdmin);
router.get("/orders/:id", validate(idParamSchema, "params"), getOrderForAdmin);

router.post(
  "/orders/:id/confirm-supplier-stock",
  validate(idParamSchema, "params"),
  confirmSupplierStock,
);

router.post(
  "/orders/:id/reject-supplier-stock",
  validate(idParamSchema, "params"),
  validate(rejectSupplierStockSchema),
  rejectSupplierStock,
);

export { router as adminOrderRouter };
