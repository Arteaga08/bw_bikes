import { Router } from "express";
import {
  getApplicationsStatsHandler,
  getInventoryStatsHandler,
  getOperationalAlertsHandler,
  getOrdersStatsHandler,
  getPreferencesStatsHandler,
  getStatsOverviewHandler,
} from "../controllers/stats.controller.js";
import { protect, restrictTo, validate } from "../middlewares/index.js";
import { statsRangeQuerySchema } from "../validators/index.js";

/**
 * Read-only stats for the admin panel (M7). Same guard as every other admin
 * router — `protect` + `restrictTo`, no rate limit (§7: auth + role is the
 * barrier on admin routes).
 *
 * `/overview` is mounted **last**, after every module route — it composes
 * them and adds nothing of its own, so it belongs at the bottom of this file
 * the same way it's built last in `stats/overview.stats.ts`.
 */
const router = Router();

router.use(protect, restrictTo("admin", "superadmin"));

router.get("/stats/orders", validate(statsRangeQuerySchema, "query"), getOrdersStatsHandler);
router.get("/stats/inventory", validate(statsRangeQuerySchema, "query"), getInventoryStatsHandler);
router.get("/stats/applications", validate(statsRangeQuerySchema, "query"), getApplicationsStatsHandler);
router.get("/stats/preferences", validate(statsRangeQuerySchema, "query"), getPreferencesStatsHandler);
router.get("/stats/alerts", getOperationalAlertsHandler);
router.get("/stats/overview", validate(statsRangeQuerySchema, "query"), getStatsOverviewHandler);

export { router as adminStatsRouter };
