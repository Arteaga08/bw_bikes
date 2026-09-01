import { Router } from "express";
import { accountRouter } from "./account.route.js";
import { adminApplicationRouter } from "./admin-application.route.js";
import { adminAuditLogRouter } from "./admin-audit-log.route.js";
import { adminCatalogRouter } from "./admin-catalog.route.js";
import { adminContentRouter } from "./admin-content.route.js";
import { adminInventoryRouter } from "./admin-inventory.route.js";
import { adminOrderRouter } from "./admin-order.route.js";
import { adminCouponRouter } from "./admin-coupon.route.js";
import { adminCustomerRouter } from "./admin-customer.route.js";
import { adminSettingsRouter } from "./admin-settings.route.js";
import { adminStatsRouter } from "./admin-stats.route.js";
import { applicationRouter } from "./application.route.js";
import { authRouter } from "./auth.route.js";
import { cartRouter } from "./cart.route.js";
import { catalogRouter } from "./catalog.route.js";
import { contentRouter } from "./content.route.js";
import { healthRouter } from "./health.route.js";
import { orderRouter } from "./order.route.js";
import { webhookRouter } from "./webhook.route.js";

/**
 * Versioned API router (`/api/v1`). Domain routers (auth, catalog, orders...)
 * are mounted here as each milestone lands.
 *
 * `/catalog` is anonymous and read-only; `/admin` is the authenticated,
 * role-restricted write surface. Splitting them by prefix keeps the guard
 * unambiguous — every route under `/admin` is behind `protect` + `restrictTo`
 * by construction, not by remembering to add it per route.
 */
const v1Router = Router();

v1Router.use("/health", healthRouter);
v1Router.use("/auth", authRouter);
v1Router.use("/catalog", catalogRouter);
v1Router.use("/content", contentRouter);
v1Router.use("/cart", cartRouter);
v1Router.use("/account", accountRouter);
v1Router.use("/orders", orderRouter);
v1Router.use("/applications", applicationRouter);
v1Router.use("/admin", adminCatalogRouter);
v1Router.use("/admin", adminContentRouter);
v1Router.use("/admin", adminInventoryRouter);
v1Router.use("/admin", adminOrderRouter);
v1Router.use("/admin", adminApplicationRouter);
v1Router.use("/admin", adminCouponRouter);
v1Router.use("/admin", adminCustomerRouter);
v1Router.use("/admin", adminSettingsRouter);
v1Router.use("/admin", adminStatsRouter);
v1Router.use("/admin", adminAuditLogRouter);

export { v1Router, webhookRouter };
