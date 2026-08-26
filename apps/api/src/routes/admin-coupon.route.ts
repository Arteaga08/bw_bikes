import { Router } from "express";
import {
  createCoupon,
  deleteCoupon,
  getCoupon,
  listCoupons,
  sendCoupon,
  updateCoupon,
} from "../controllers/coupon.controller.js";
import { protect, restrictTo, validate } from "../middlewares/index.js";
import {
  couponListQuerySchema,
  createCouponSchema,
  idParamSchema,
  sendCouponSchema,
  updateCouponSchema,
} from "../validators/index.js";

/**
 * Coupon campaigns (M18).
 *
 * No rate limiter, per the same rule the other admin routers state: on an
 * admin surface the barrier is authentication plus role plus the mandatory
 * TOTP that `protect` re-checks on every request, not a request budget.
 *
 * The customer-facing half of this feature lives in `cart.route.ts`, where the
 * calculus is the opposite — see `couponRateLimiter` there.
 */
const router = Router();

router.use(protect, restrictTo("admin", "superadmin"));

router.get("/coupons", validate(couponListQuerySchema, "query"), listCoupons);
router.post("/coupons", validate(createCouponSchema), createCoupon);
router.get("/coupons/:id", validate(idParamSchema, "params"), getCoupon);
router.patch("/coupons/:id", validate(idParamSchema, "params"), validate(updateCouponSchema), updateCoupon);
router.delete("/coupons/:id", validate(idParamSchema, "params"), deleteCoupon);

// Sending is not redeeming: a campaign emailed to a hundred people who never
// buy has cost the shop nothing, and must not report a hundred redemptions.
router.post(
  "/coupons/:id/send",
  validate(idParamSchema, "params"),
  validate(sendCouponSchema),
  sendCoupon,
);

export { router as adminCouponRouter };
