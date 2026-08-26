import { Router } from "express";
import {
  generateCustomerCoupon,
  getCustomer,
  getCustomersStatsHandler,
  listCustomers,
} from "../controllers/customer.controller.js";
import { protect, restrictTo, validate } from "../middlewares/index.js";
import {
  customerListQuerySchema,
  generateCouponForCustomerSchema,
  idParamSchema,
  statsRangeQuerySchema,
} from "../validators/index.js";

/**
 * The customer registry and its segments (M20).
 *
 * Read-only on the customer record itself. Editing one is not a CRM operation
 * the shop asked for, and an admin able to rewrite someone's email is an
 * account-takeover path that no screen here needs. The one write is
 * `POST /:id/coupons`, which creates a *coupon* — it never touches the user.
 *
 * No rate limiter, same rule as the other admin routers: auth + role + the
 * TOTP `protect` re-checks on every request.
 */
const router = Router();

router.use(protect, restrictTo("admin", "superadmin"));

router.get("/customers", validate(customerListQuerySchema, "query"), listCustomers);
router.get("/customers/:id", validate(idParamSchema, "params"), getCustomer);
router.get("/stats/customers", validate(statsRangeQuerySchema, "query"), getCustomersStatsHandler);

router.post(
  "/customers/:id/coupons",
  validate(idParamSchema, "params"),
  validate(generateCouponForCustomerSchema),
  generateCustomerCoupon,
);

export { router as adminCustomerRouter };
