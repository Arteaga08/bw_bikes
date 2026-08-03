import { Router } from "express";
import { healthRouter } from "./health.route.js";

/**
 * Versioned API router (`/api/v1`). Domain routers (auth, catalog, orders...)
 * are mounted here as each milestone lands.
 */
const v1Router = Router();

v1Router.use("/health", healthRouter);

export { v1Router };
