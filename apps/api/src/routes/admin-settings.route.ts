import { Router } from "express";
import {
  getSettings,
  updateApplicationsSettings,
  updateInventorySettings,
  updateJobsSettings,
  updateOrdersSettings,
  updatePricingSettings,
  updateShippingSettings,
} from "../controllers/settings.controller.js";
import { protect, restrictTo, validate } from "../middlewares/index.js";
import {
  settingsApplicationsSchema,
  settingsInventorySchema,
  settingsJobsSchema,
  settingsOrdersSchema,
  settingsPricingSchema,
  settingsShippingSchema,
} from "../validators/index.js";

/**
 * `Settings` singleton, editable by section (M7). Same guard as every other
 * admin router — `protect` + `restrictTo` for the whole router, no rate
 * limit (BACKEND_SECURITY_GUIDELINES.md §7: the barrier here is auth plus
 * role).
 *
 * One `PUT` per section, never a single endpoint that takes a section name
 * as a body/param field: routing on the URL is what lets each write carry
 * its own Joi schema, its own audit action, and makes "which section can
 * this write touch" answerable by reading the router alone.
 */
const router = Router();

router.use(protect, restrictTo("admin", "superadmin"));

router.get("/settings", getSettings);

router.put("/settings/inventory", validate(settingsInventorySchema), updateInventorySettings);
router.put("/settings/orders", validate(settingsOrdersSchema), updateOrdersSettings);
router.put("/settings/pricing", validate(settingsPricingSchema), updatePricingSettings);
router.put("/settings/shipping", validate(settingsShippingSchema), updateShippingSettings);
router.put("/settings/applications", validate(settingsApplicationsSchema), updateApplicationsSettings);
router.put("/settings/jobs", validate(settingsJobsSchema), updateJobsSettings);

export { router as adminSettingsRouter };
