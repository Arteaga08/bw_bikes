import { Router } from "express";
import { listPublicHeroSlides } from "../controllers/hero-slide.controller.js";
import { publicReadRateLimiter } from "../middlewares/index.js";

/**
 * Public, read-only, anonymous editorial content — the storefront's home
 * hero (M12, entrega 2). Its own router rather than an endpoint inside
 * `catalog.route.ts`: this serves content, not catalog documents, and the
 * distinction is the same one that keeps `Settings` (config) and this
 * (content) as separate collections.
 *
 * `publicReadRateLimiter` for the same reason `catalog.route.ts` carries it:
 * an anonymous endpoint anyone can hit, so the control is anti-scraping.
 */
const router = Router();

router.use(publicReadRateLimiter);

router.get("/hero-slides", listPublicHeroSlides);

export { router as contentRouter };
