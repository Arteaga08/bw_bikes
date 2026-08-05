import { Router } from "express";
import {
  approveApplication,
  getApplicationForAdmin,
  listApplicationsForAdmin,
  rejectApplication,
} from "../controllers/application.controller.js";
import { protect, restrictTo, validate } from "../middlewares/index.js";
import {
  adminApplicationListQuerySchema,
  idParamSchema,
  rejectApplicationSchema,
} from "../validators/index.js";

/**
 * The approval bandeja for ambassador/sponsorship applications. Same guard as
 * every other admin router — `protect` + `restrictTo` for the whole router,
 * no rate limit (BACKEND_SECURITY_GUIDELINES.md §7: the barrier here is auth
 * plus role).
 */
const router = Router();

router.use(protect, restrictTo("admin", "superadmin"));

router.get("/applications", validate(adminApplicationListQuerySchema, "query"), listApplicationsForAdmin);
router.get("/applications/:id", validate(idParamSchema, "params"), getApplicationForAdmin);

router.post("/applications/:id/approve", validate(idParamSchema, "params"), approveApplication);

router.post(
  "/applications/:id/reject",
  validate(idParamSchema, "params"),
  validate(rejectApplicationSchema),
  rejectApplication,
);

export { router as adminApplicationRouter };
