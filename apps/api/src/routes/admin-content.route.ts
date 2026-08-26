import { Router } from "express";
import {
  getAdminBikeOfMonth,
  removeBikeOfMonthImage,
  updateBikeOfMonth,
  uploadBikeOfMonthImage,
} from "../controllers/bike-of-month.controller.js";
import { listAdminHomeTiles, removeHomeTileImage, uploadHomeTileImage } from "../controllers/home-tile.controller.js";
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
import {
  bikeOfMonthImageSchema,
  bikeOfMonthSchema,
  heroSlideImageSchema,
  heroSlideSchema,
  homeTileImageSchema,
  homeTileSlotParamSchema,
  idParamSchema,
  reorderHeroSlidesSchema,
} from "../validators/index.js";

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

/**
 * The home's two CTA tile photos (M12, entrega 6) — just the two slots
 * fixed by `HOME_TILE_SLOTS`, no create/update/delete/reorder: only the
 * image per slot is admin-managed.
 */
router.get("/content/home-tiles", listAdminHomeTiles);
router.post(
  "/content/home-tiles/:slot/image",
  validate(homeTileSlotParamSchema, "params"),
  uploadImages,
  validate(homeTileImageSchema),
  uploadHomeTileImage,
);
router.delete("/content/home-tiles/:slot/image", validate(homeTileSlotParamSchema, "params"), removeHomeTileImage);

/**
 * The home's single "bici del mes" banner — one document, no
 * create/delete/reorder: only its text and photo are admin-managed, same
 * shape of endpoint set as the home tiles above.
 */
router.get("/content/bike-of-month", getAdminBikeOfMonth);
router.put("/content/bike-of-month", validate(bikeOfMonthSchema), updateBikeOfMonth);
router.post("/content/bike-of-month/image", uploadImages, validate(bikeOfMonthImageSchema), uploadBikeOfMonthImage);
router.delete("/content/bike-of-month/image", removeBikeOfMonthImage);

export { router as adminContentRouter };
