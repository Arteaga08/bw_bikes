import { Router } from "express";
import { createOrder, getMyOrder, listMyOrders } from "../controllers/order.controller.js";
import { checkoutRateLimiter, protect, validate } from "../middlewares/index.js";
import { createOrderSchema, idParamSchema, orderListQuerySchema } from "../validators/index.js";

/**
 * The customer's own orders.
 *
 * `GET /:id` is the classic IDOR target, so ownership is enforced inside the
 * service as part of the query filter — never as a check after loading the
 * document — and a miss answers 404 rather than 403.
 *
 * `POST /` carries the milestone's only dedicated limiter: it mints a payment
 * intent and holds real inventory on every call.
 */
const router = Router();

router.use(protect);

router.post("/", checkoutRateLimiter, validate(createOrderSchema), createOrder);
router.get("/", validate(orderListQuerySchema, "query"), listMyOrders);
router.get("/:id", validate(idParamSchema, "params"), getMyOrder);

export { router as orderRouter };
