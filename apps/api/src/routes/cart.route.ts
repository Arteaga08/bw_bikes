import { Router } from "express";
import {
  addCartLine,
  clearCart,
  getCart,
  removeCartLine,
  updateCartLine,
} from "../controllers/cart.controller.js";
import { protect, validate } from "../middlewares/index.js";
import { addCartLineSchema, cartLineParamSchema, updateCartLineSchema } from "../validators/index.js";

/**
 * The authenticated customer's cart.
 *
 * `protect` on the whole router and **no id in any path**: the cart resolved is
 * always `req.user`'s. There is nothing here to enumerate.
 *
 * No rate limiter. These are cheap authenticated writes on a document capped at
 * 20 lines, already behind the global backstop, and unlike checkout they touch
 * neither stock nor money. The dedicated limiter belongs where the cost is —
 * `POST /orders`.
 */
const router = Router();

router.use(protect);

router.get("/", getCart);
router.delete("/", clearCart);

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
