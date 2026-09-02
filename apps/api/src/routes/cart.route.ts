import { Router } from "express";
import {
  addCartLine,
  applyCartCoupon,
  clearCart,
  getCart,
  removeCartBillingInfo,
  removeCartCoupon,
  removeCartLine,
  setCartBillingInfo,
  setCartShippingAddress,
  updateCartLine,
} from "../controllers/cart.controller.js";
import { couponRateLimiter, protect, validate } from "../middlewares/index.js";
import {
  addCartLineSchema,
  applyCouponSchema,
  billingInfoSchema,
  cartLineParamSchema,
  shippingAddressSchema,
  updateCartLineSchema,
} from "../validators/index.js";

/**
 * The authenticated customer's cart.
 *
 * `protect` on the whole router and **no id in any path**: the cart resolved is
 * always `req.user`'s. There is nothing here to enumerate.
 *
 * No blanket rate limiter. These are cheap authenticated writes on a document
 * capped at 20 lines, already behind the global backstop, and unlike checkout
 * they touch neither stock nor money. The dedicated limiter belongs where the
 * cost is — `POST /orders`.
 *
 * The one exception is `POST /coupon`: it answers a yes/no question about a
 * short, guessable secret, which makes it a brute-force oracle unless bounded.
 * `DELETE /coupon` is exempt — removing something you already applied reveals
 * nothing.
 */
const router = Router();

router.use(protect);

router.get("/", getCart);
router.delete("/", clearCart);

router.put("/shipping-address", validate(shippingAddressSchema), setCartShippingAddress);
router.put("/billing-info", validate(billingInfoSchema), setCartBillingInfo);
router.delete("/billing-info", removeCartBillingInfo);

router.post("/coupon", couponRateLimiter, validate(applyCouponSchema), applyCartCoupon);
router.delete("/coupon", removeCartCoupon);

router.post("/lines", validate(addCartLineSchema), addCartLine);

// Both parts of the line's identity live in the path: SKUs are unique per
// catalog, not globally, so `:itemType` disambiguates them.
router.patch(
  "/lines/:itemType/:sku",
  validate(cartLineParamSchema, "params"),
  validate(updateCartLineSchema),
  updateCartLine,
);
router.delete("/lines/:itemType/:sku", validate(cartLineParamSchema, "params"), removeCartLine);

export { router as cartRouter };
