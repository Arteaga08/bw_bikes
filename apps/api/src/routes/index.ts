import { Router } from "express";
import { adminCatalogRouter } from "./admin-catalog.route.js";
import { adminInventoryRouter } from "./admin-inventory.route.js";
import { authRouter } from "./auth.route.js";
import { catalogRouter } from "./catalog.route.js";
import { healthRouter } from "./health.route.js";

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
v1Router.use("/admin", adminCatalogRouter);
v1Router.use("/admin", adminInventoryRouter);

export { v1Router };
