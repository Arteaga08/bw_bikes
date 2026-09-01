import { Router } from "express";
import {
  changePasswordHandler,
  createAddressHandler,
  getAccountHandler,
  listAddressesHandler,
  removeAddressHandler,
  removeBillingInfoHandler,
  setBillingInfoHandler,
  setDefaultAddressHandler,
  updateAddressHandler,
  updateProfileHandler,
} from "../controllers/account.controller.js";
import { authActionRateLimiter, protect, validate } from "../middlewares/index.js";
import {
  accountBillingInfoSchema,
  addressIdParamSchema,
  changePasswordSchema,
  saveAddressSchema,
  updateProfileSchema,
} from "../validators/index.js";

/**
 * The authenticated customer's account. `protect` on the whole router and no
 * id in any path — same shape as `cart.route.ts`, the resource resolved is
 * always `req.user`'s, so there is nothing here to enumerate.
 *
 * `POST /password` gets `authActionRateLimiter`: like `/auth/login`, it's a
 * credential check (the current password) and a side-effect sensitive one
 * (revokes every other session).
 */
const router = Router();

router.use(protect);

router.get("/", getAccountHandler);
router.patch("/profile", validate(updateProfileSchema), updateProfileHandler);
router.post("/password", authActionRateLimiter, validate(changePasswordSchema), changePasswordHandler);

router.get("/addresses", listAddressesHandler);
router.post("/addresses", validate(saveAddressSchema), createAddressHandler);
router.patch(
  "/addresses/:addressId",
  validate(addressIdParamSchema, "params"),
  validate(saveAddressSchema),
  updateAddressHandler,
);
router.delete("/addresses/:addressId", validate(addressIdParamSchema, "params"), removeAddressHandler);
router.post(
  "/addresses/:addressId/default",
  validate(addressIdParamSchema, "params"),
  setDefaultAddressHandler,
);

router.put("/billing-info", validate(accountBillingInfoSchema), setBillingInfoHandler);
router.delete("/billing-info", removeBillingInfoHandler);

export { router as accountRouter };
