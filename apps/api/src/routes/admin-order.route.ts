import { Router } from "express";
import {
  addOrderInternalNote,
  bulkUpdateOrderStatus,
  confirmSupplierStock,
  getOrderActivityForAdmin,
  getOrderForAdmin,
  getOrdersSummaryForAdmin,
  listOrdersForAdmin,
  recordOrderShipment,
  rejectSupplierStock,
  updateOrderPriority,
  updateOrderShippingAddress,
} from "../controllers/order.controller.js";
import { protect, restrictTo, validate } from "../middlewares/index.js";
import {
  addOrderNoteSchema,
  adminOrderListQuerySchema,
  bulkOrderStatusSchema,
  idParamSchema,
  recordShipmentSchema,
  rejectSupplierStockSchema,
  shippingAddressSchema,
  updateOrderPrioritySchema,
} from "../validators/index.js";

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

// Registered ahead of `/orders/:id`, same reasoning as `bulk-status` below: a
// fixed segment must win over the wildcard param, or this would be read as a
// lookup for the order whose id is literally "summary".
router.get("/orders/summary", getOrdersSummaryForAdmin);

// Registered ahead of `/orders/:id`: a fixed segment must win over the
// wildcard param, or `PATCH /orders/bulk-status` would be read as an update
// to the order whose id is literally "bulk-status".
router.patch("/orders/bulk-status", validate(bulkOrderStatusSchema), bulkUpdateOrderStatus);

router.get("/orders/:id", validate(idParamSchema, "params"), getOrderForAdmin);

router.get("/orders/:id/activity", validate(idParamSchema, "params"), getOrderActivityForAdmin);

router.patch(
  "/orders/:id/priority",
  validate(idParamSchema, "params"),
  validate(updateOrderPrioritySchema),
  updateOrderPriority,
);

router.post(
  "/orders/:id/notes",
  validate(idParamSchema, "params"),
  validate(addOrderNoteSchema),
  addOrderInternalNote,
);

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

router.patch(
  "/orders/:id/shipping-address",
  validate(idParamSchema, "params"),
  validate(shippingAddressSchema),
  updateOrderShippingAddress,
);

router.patch(
  "/orders/:id/shipment",
  validate(idParamSchema, "params"),
  validate(recordShipmentSchema),
  recordOrderShipment,
);

export { router as adminOrderRouter };
