import { Router } from "express";
import { changePasswordHandler, getAccountHandler, updateProfileHandler } from "../controllers/account.controller.js";
import { authActionRateLimiter, protect, validate } from "../middlewares/index.js";
import { changePasswordSchema, updateProfileSchema } from "../validators/index.js";

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

export { router as accountRouter };
