import { Router } from "express";
import { adminApplicationRouter } from "./admin-application.route.js";
import { adminCatalogRouter } from "./admin-catalog.route.js";
import { adminInventoryRouter } from "./admin-inventory.route.js";
import { adminOrderRouter } from "./admin-order.route.js";
import { adminSettingsRouter } from "./admin-settings.route.js";
import { adminStatsRouter } from "./admin-stats.route.js";
import { applicationRouter } from "./application.route.js";
import { authRouter } from "./auth.route.js";
import { cartRouter } from "./cart.route.js";
import { catalogRouter } from "./catalog.route.js";
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
v1Router.use("/cart", cartRouter);
v1Router.use("/orders", orderRouter);
v1Router.use("/applications", applicationRouter);
v1Router.use("/admin", adminCatalogRouter);
v1Router.use("/admin", adminInventoryRouter);
v1Router.use("/admin", adminOrderRouter);
v1Router.use("/admin", adminApplicationRouter);
v1Router.use("/admin", adminSettingsRouter);
v1Router.use("/admin", adminStatsRouter);

export { v1Router, webhookRouter };
