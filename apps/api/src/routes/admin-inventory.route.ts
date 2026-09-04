import { Router } from "express";
import {
  adjustInventoryStock,
  createInventoryItem,
  getInventoryItem,
  getInventoryProduct,
  getInventorySummary,
  listInventory,
  listInventoryProducts,
} from "../controllers/inventory.controller.js";
import { protect, restrictTo, validate } from "../middlewares/index.js";
import {
  adjustStockSchema,
  createInventoryItemSchema,
  idParamSchema,
  inventoryListQuerySchema,
  inventoryProductListQuerySchema,
  inventoryProductQuerySchema,
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

// Registered ahead of `/inventory/:id`, same reasoning as `/orders/summary`:
// a fixed segment must win over the wildcard param, or this would be read as
// a lookup for the item whose id is literally "summary".
router.get("/inventory/summary", getInventorySummary);

// Same reasoning again: `/inventory/products` has the same segment count as
// `/inventory/:id` and must be registered first, or it reads as a lookup for
// the item whose id is literally "products". The product-first list behind
// the redesigned `/admin/inventario` — one row per product, not per SKU.
router.get("/inventory/products", validate(inventoryProductListQuerySchema, "query"), listInventoryProducts);
router.get(
  "/inventory/products/:id",
  validate(idParamSchema, "params"),
  validate(inventoryProductQuerySchema, "query"),
  getInventoryProduct,
);

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
