import { Router } from "express";
import {
  createHeroSlide,
  deleteHeroSlide,
  listAdminHeroSlides,
  removeHeroSlideImage,
  reorderHeroSlides,
  updateHeroSlide,
  uploadHeroSlideImage,
} from "../controllers/hero-slide.controller.js";
import { protect, restrictTo, uploadImages, validate } from "../middlewares/index.js";
import { heroSlideImageSchema, heroSlideSchema, idParamSchema, reorderHeroSlidesSchema } from "../validators/index.js";

/**
 * Admin CRUD for the home hero's carousel (M12, entrega 2). Same guard as
 * every other admin router (`protect` + `restrictTo`, no rate limit — auth
 * plus role is the barrier, BACKEND_SECURITY_GUIDELINES.md §7).
 *
 * `/content` rather than folding this into `admin-catalog.route.ts`: a hero
 * slide is editorial content, not a catalog document — it has no place in
 * the bike/accessory/category tree.
 */
const router = Router();

router.use(protect, restrictTo("admin", "superadmin"));

router.get("/content/hero-slides", listAdminHeroSlides);
router.post("/content/hero-slides", validate(heroSlideSchema), createHeroSlide);
router.put("/content/hero-slides/reorder", validate(reorderHeroSlidesSchema), reorderHeroSlides);
router.put("/content/hero-slides/:id", validate(idParamSchema, "params"), validate(heroSlideSchema), updateHeroSlide);
router.delete("/content/hero-slides/:id", validate(idParamSchema, "params"), deleteHeroSlide);
router.post(
  "/content/hero-slides/:id/image",
  validate(idParamSchema, "params"),
  uploadImages,
  validate(heroSlideImageSchema),
  uploadHeroSlideImage,
);
router.delete("/content/hero-slides/:id/image", validate(idParamSchema, "params"), removeHeroSlideImage);

export { router as adminContentRouter };
