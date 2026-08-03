import { Router } from "express";
import { asyncHandler, sendResponse } from "../utils/index.js";

const router = Router();

/**
 * Liveness/readiness probe. Deliberately outside auth and outside the
 * per-action rate limiters — infra health checks must never be throttled or
 * blocked by a missing session.
 */
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    sendResponse(res, 200, "OK", { uptime: process.uptime(), timestamp: new Date().toISOString() });
  }),
);

export { router as healthRouter };
