import { Router } from "express";
import {
  getAccessoryColorSwatches,
  getAccessoryFilterOptions,
  getPublicAccessoryBySlug,
  listPublicAccessories,
} from "../controllers/accessory.controller.js";
import {
  getBikeColorSwatches,
  getBikeFilterOptions,
  getBikeSizeGuide,
  getPublicBikeBySlug,
  listPublicBikes,
} from "../controllers/bike.controller.js";
import { getPublicBrandBySlug, listPublicBrands } from "../controllers/brand.controller.js";
import { listPublicOnSale } from "../controllers/catalog.controller.js";
import { createCategoryController } from "../controllers/category.controller.js";
import { getPublicAvailability } from "../controllers/inventory.controller.js";
import { recordProductView } from "../controllers/product-view.controller.js";
import { productViewRateLimiter, publicReadRateLimiter, validate } from "../middlewares/index.js";
import { accessoryCategoryService } from "../services/accessory-category.service.js";
import { bikeCategoryService } from "../services/bike-category.service.js";
import {
  bikeSizeGuideQuerySchema,
  brandListQuerySchema,
  categoryListQuerySchema,
  productViewSchema,
  publicAvailabilityQuerySchema,
  publicProductListQuerySchema,
  slugParamSchema,
} from "../validators/index.js";

/**
 * Public, read-only catalog. Everything here serves only active, non-archived
 * documents and the trimmed public DTOs — the storefront (M12) is the
 * consumer.
 *
 * Rate limited with `publicReadRateLimiter` (500/15min): these are anonymous
 * endpoints exposing the full catalog, so the control is anti-scraping, not
 * anti-brute-force (BACKEND_SECURITY_GUIDELINES.md §7).
 */
const router = Router();

router.use(publicReadRateLimiter);

// `folder` is unused on this public, read-only router (none of these routes
// touch `uploadImage`), but `createCategoryController` requires it — reusing
// the same values as `admin-catalog.route.ts` keeps the two instantiations
// in sync rather than passing an arbitrary placeholder.
const bikeCategories = createCategoryController(
  bikeCategoryService,
  { plural: "Categorías de bicicletas" },
  "bike-categories",
);
const accessoryCategories = createCategoryController(
  accessoryCategoryService,
  { plural: "Categorías de accesorios" },
  "accessory-categories",
);

// Two independent trees, two independent sets of endpoints.
router.get("/bike-categories", validate(categoryListQuerySchema, "query"), bikeCategories.listPublic);
router.get("/bike-categories/tree", bikeCategories.treePublic);
router.get("/bike-categories/:slug", validate(slugParamSchema, "params"), bikeCategories.getBySlugPublic);

router.get(
  "/accessory-categories",
  validate(categoryListQuerySchema, "query"),
  accessoryCategories.listPublic,
);
router.get("/accessory-categories/tree", accessoryCategories.treePublic);
router.get(
  "/accessory-categories/:slug",
  validate(slugParamSchema, "params"),
  accessoryCategories.getBySlugPublic,
);

router.get("/brands", validate(brandListQuerySchema, "query"), listPublicBrands);
router.get("/brands/:slug", validate(slugParamSchema, "params"), getPublicBrandBySlug);

router.get("/bikes", validate(publicProductListQuerySchema, "query"), listPublicBikes);
// Must come before `/bikes/:slug` — otherwise Express matches "filter-options"
// against the `:slug` param and this 404s instead of running (same class of
// mistake `getPublicBikeCategoryTree`'s doc comment already warns about for
// the missing `/catalog` prefix).
router.get("/bikes/filter-options", getBikeFilterOptions);
// Same `:slug`-collision reasoning as `filter-options` above.
router.get("/bikes/colors", getBikeColorSwatches);
// Same reasoning, and same fix — not nested under `/bikes` at all, so there's
// no `:slug` to collide with regardless, but it lives here with its sibling
// bike-scoped reads rather than at the bottom of the file.
router.get("/bike-size-guide", validate(bikeSizeGuideQuerySchema, "query"), getBikeSizeGuide);
router.get("/bikes/:slug", validate(slugParamSchema, "params"), getPublicBikeBySlug);

router.get("/accessories", validate(publicProductListQuerySchema, "query"), listPublicAccessories);
router.get("/accessories/filter-options", getAccessoryFilterOptions);
// Same `:slug`-collision reasoning as `filter-options` above.
router.get("/accessories/colors", getAccessoryColorSwatches);
router.get("/accessories/:slug", validate(slugParamSchema, "params"), getPublicAccessoryBySlug);

// The storefront's "Ofertas" listing — bikes and accessories merged into one
// paginated, discount-only result (`on-sale.service.ts`). Own route, no
// `:slug` to collide with, same query schema as `/bikes`/`/accessories`
// (`onSale` itself is forced server-side, not read from the request).
router.get("/on-sale", validate(publicProductListQuerySchema, "query"), listPublicOnSale);

// M7: anonymous "someone looked at this" event, feeding the preferences
// report. `productViewRateLimiter` runs in addition to the router-wide
// `publicReadRateLimiter` above — see that limiter's own comment.
router.post("/views", productViewRateLimiter, validate(productViewSchema), recordProductView);

// M13-B: the one read on this router that must never be cached — stock is far
// more volatile than the 300s the storefront caches the rest of the catalog
// for, so this stays its own uncached endpoint instead of riding along on any
// product DTO.
router.get("/availability", validate(publicAvailabilityQuerySchema, "query"), getPublicAvailability);

export { router as catalogRouter };
