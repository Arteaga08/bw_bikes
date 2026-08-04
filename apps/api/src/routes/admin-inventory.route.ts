import { Router } from "express";
import {
  adjustInventoryStock,
  createInventoryItem,
  getInventoryItem,
  listInventory,
} from "../controllers/inventory.controller.js";
import { protect, restrictTo, validate } from "../middlewares/index.js";
import {
  adjustStockSchema,
  createInventoryItemSchema,
  idParamSchema,
  inventoryListQuerySchema,
} from "../validators/index.js";

/**
 * Stock administration. Same guard as the admin catalog router — `protect` +
 * `restrictTo` for the whole router, and deliberately no rate limit: per
 * BACKEND_SECURITY_GUIDELINES.md §7 the barrier on admin routes is auth plus
 * role (an admin session already carries mandatory 2FA), not throttling.
 *
 * There is no route here that *reserves* stock. Reservations belong to a
 * checkout, and the checkout is M5 — `inventoryService.reserve/commit/release`
 * is the contract that milestone will call. Exposing a reservation endpoint
 * now would put a way to hold stock in the open with no order behind it.
 */
const router = Router();

router.use(protect, restrictTo("admin", "superadmin"));

router.get("/inventory", validate(inventoryListQuerySchema, "query"), listInventory);
router.post("/inventory", validate(createInventoryItemSchema), createInventoryItem);
router.get("/inventory/:id", validate(idParamSchema, "params"), getInventoryItem);

// Physical stock only. `reserved` has no endpoint on purpose — it moves only
// as the consequence of a real reservation.
router.patch(
  "/inventory/:id/stock",
  validate(idParamSchema, "params"),
  validate(adjustStockSchema),
  adjustInventoryStock,
);

export { router as adminInventoryRouter };
