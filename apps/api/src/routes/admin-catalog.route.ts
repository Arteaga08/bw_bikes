import { Router } from "express";
import {
  archiveAccessory,
  createAccessory,
  deleteAccessory,
  deleteAccessoryGalleryImage,
  getAdminAccessory,
  listAdminAccessories,
  reorderAccessoryGallery,
  replaceAccessorySpecGroups,
  restoreAccessory,
  updateAccessory,
  uploadAccessoryGallery,
} from "../controllers/accessory.controller.js";
import {
  archiveBike,
  createBike,
  deleteBike,
  deleteBikeGalleryImage,
  getAdminBike,
  listAdminBikes,
  reorderBikeGallery,
  replaceBikeSpecGroups,
  restoreBike,
  updateBike,
  uploadBikeGallery,
} from "../controllers/bike.controller.js";
import { createBadge, deleteBadge, getAdminBadge, listAdminBadges, updateBadge } from "../controllers/badge.controller.js";
import {
  createBrand,
  deleteBrand,
  getAdminBrand,
  listAdminBrands,
  removeBrandLogo,
  updateBrand,
  uploadBrandLogo,
} from "../controllers/brand.controller.js";
import { createCategoryController } from "../controllers/category.controller.js";
import {
  createSpecTemplate,
  deleteSpecTemplate,
  getAdminSpecTemplate,
  listAdminSpecTemplates,
  updateSpecTemplate,
} from "../controllers/spec-template.controller.js";
import { protect, restrictTo, uploadImages, validate } from "../middlewares/index.js";
import { accessoryCategoryService } from "../services/accessory-category.service.js";
import { bikeCategoryService } from "../services/bike-category.service.js";
import {
  adminProductListQuerySchema,
  badgeListQuerySchema,
  brandListQuerySchema,
  categoryListQuerySchema,
  createAccessorySchema,
  createBadgeSchema,
  createBikeSchema,
  createBrandSchema,
  createCategorySchema,
  createSpecTemplateSchema,
  deleteGalleryImageSchema,
  idParamSchema,
  reorderGallerySchema,
  replaceSpecGroupsSchema,
  specTemplateListQuerySchema,
  updateAccessorySchema,
  updateBadgeSchema,
  updateBikeSchema,
  updateBrandSchema,
  updateCategorySchema,
  updateSpecTemplateSchema,
  uploadGalleryImagesSchema,
} from "../validators/index.js";

/**
 * Admin catalog CRUD. Guarded by `protect` + `restrictTo` for the whole
 * router — an admin session already carries mandatory 2FA (see `protect`), so
 * the barrier here is auth + role, not throttling: per
 * BACKEND_SECURITY_GUIDELINES.md §7 admin routes are deliberately **not**
 * rate limited, since an admin doing legitimate bulk work shouldn't be
 * throttled.
 */
const router = Router();

router.use(protect, restrictTo("admin", "superadmin"));

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

/** Both category trees expose an identical CRUD surface on their own path. */
function mountCategoryRoutes(basePath: string, controller: ReturnType<typeof createCategoryController>): void {
  router.get(basePath, validate(categoryListQuerySchema, "query"), controller.listAdmin);
  router.post(basePath, validate(createCategorySchema), controller.create);
  router.get(`${basePath}/tree`, controller.treeAdmin);
  router.get(`${basePath}/:id`, validate(idParamSchema, "params"), controller.getByIdAdmin);
  router.patch(
    `${basePath}/:id`,
    validate(idParamSchema, "params"),
    validate(updateCategorySchema),
    controller.update,
  );
  router.delete(`${basePath}/:id`, validate(idParamSchema, "params"), controller.remove);

  // A category carries at most one image — `uploadGalleryImagesSchema`
  // (just `alt?`) is reused as-is; there's no per-image publicId/order
  // schema to reuse from the product gallery because there's nothing to
  // pick among or reorder.
  router.post(
    `${basePath}/:id/image`,
    validate(idParamSchema, "params"),
    uploadImages,
    validate(uploadGalleryImagesSchema),
    controller.uploadImage,
  );
  router.delete(`${basePath}/:id/image`, validate(idParamSchema, "params"), controller.removeImage);
}

mountCategoryRoutes("/bike-categories", bikeCategories);
mountCategoryRoutes("/accessory-categories", accessoryCategories);

// --- Brands ----------------------------------------------------------------
// One collection shared by both catalogs — a brand sells bikes and
// accessories alike, so there's exactly one CRUD surface, not one per tree.

router.get("/brands", validate(brandListQuerySchema, "query"), listAdminBrands);
router.post("/brands", validate(createBrandSchema), createBrand);
router.get("/brands/:id", validate(idParamSchema, "params"), getAdminBrand);
router.patch("/brands/:id", validate(idParamSchema, "params"), validate(updateBrandSchema), updateBrand);
router.delete("/brands/:id", validate(idParamSchema, "params"), deleteBrand);

// A brand carries at most one logo — same reuse of `uploadGalleryImagesSchema` as the category image.
router.post(
  "/brands/:id/logo",
  validate(idParamSchema, "params"),
  uploadImages,
  validate(uploadGalleryImagesSchema),
  uploadBrandLogo,
);
router.delete("/brands/:id/logo", validate(idParamSchema, "params"), removeBrandLogo);

// --- Badges ------------------------------------------------------------------
// Also shared by both catalogs, and admin-only — a badge only ever ships
// resolved onto a product, never through its own public endpoint.

router.get("/badges", validate(badgeListQuerySchema, "query"), listAdminBadges);
router.post("/badges", validate(createBadgeSchema), createBadge);
router.get("/badges/:id", validate(idParamSchema, "params"), getAdminBadge);
router.patch("/badges/:id", validate(idParamSchema, "params"), validate(updateBadgeSchema), updateBadge);
router.delete("/badges/:id", validate(idParamSchema, "params"), deleteBadge);

// --- Spec templates ----------------------------------------------------------
// Also shared, also admin-only — feeds the ficha técnica editor's "Aplicar
// plantilla" picker and its label autocomplete, never a public endpoint.

router.get("/spec-templates", validate(specTemplateListQuerySchema, "query"), listAdminSpecTemplates);
router.post("/spec-templates", validate(createSpecTemplateSchema), createSpecTemplate);
router.get("/spec-templates/:id", validate(idParamSchema, "params"), getAdminSpecTemplate);
router.patch(
  "/spec-templates/:id",
  validate(idParamSchema, "params"),
  validate(updateSpecTemplateSchema),
  updateSpecTemplate,
);
router.delete("/spec-templates/:id", validate(idParamSchema, "params"), deleteSpecTemplate);

// --- Bikes ---------------------------------------------------------------

router.get("/bikes", validate(adminProductListQuerySchema, "query"), listAdminBikes);
router.post("/bikes", validate(createBikeSchema), createBike);
router.get("/bikes/:id", validate(idParamSchema, "params"), getAdminBike);
router.patch("/bikes/:id", validate(idParamSchema, "params"), validate(updateBikeSchema), updateBike);

router.post("/bikes/:id/archive", validate(idParamSchema, "params"), archiveBike);
router.post("/bikes/:id/restore", validate(idParamSchema, "params"), restoreBike);
// Real deletion — only reachable once the bike is already archived (enforced
// in the service, not just hidden in the UI); see `product.service.ts`'s `remove()`.
router.delete("/bikes/:id", validate(idParamSchema, "params"), deleteBike);

// One atomic replace covers add / rename / reorder / delete of groups and
// fields alike — see `replaceSpecGroupsSchema` for why this isn't split into
// per-group sub-resources.
router.put(
  "/bikes/:id/spec-groups",
  validate(idParamSchema, "params"),
  validate(replaceSpecGroupsSchema),
  replaceBikeSpecGroups,
);

// `uploadImages` (multer, memory storage + hard limits) has to run before
// `validate`: until multer has parsed the multipart body, `req.body` is empty.
router.post(
  "/bikes/:id/gallery",
  validate(idParamSchema, "params"),
  uploadImages,
  validate(uploadGalleryImagesSchema),
  uploadBikeGallery,
);
router.delete(
  "/bikes/:id/gallery",
  validate(idParamSchema, "params"),
  validate(deleteGalleryImageSchema),
  deleteBikeGalleryImage,
);
router.patch(
  "/bikes/:id/gallery/order",
  validate(idParamSchema, "params"),
  validate(reorderGallerySchema),
  reorderBikeGallery,
);

// --- Accessories ---------------------------------------------------------

router.get("/accessories", validate(adminProductListQuerySchema, "query"), listAdminAccessories);
router.post("/accessories", validate(createAccessorySchema), createAccessory);
router.get("/accessories/:id", validate(idParamSchema, "params"), getAdminAccessory);
router.patch(
  "/accessories/:id",
  validate(idParamSchema, "params"),
  validate(updateAccessorySchema),
  updateAccessory,
);

router.post("/accessories/:id/archive", validate(idParamSchema, "params"), archiveAccessory);
router.post("/accessories/:id/restore", validate(idParamSchema, "params"), restoreAccessory);
router.delete("/accessories/:id", validate(idParamSchema, "params"), deleteAccessory);

router.put(
  "/accessories/:id/spec-groups",
  validate(idParamSchema, "params"),
  validate(replaceSpecGroupsSchema),
  replaceAccessorySpecGroups,
);

router.post(
  "/accessories/:id/gallery",
  validate(idParamSchema, "params"),
  uploadImages,
  validate(uploadGalleryImagesSchema),
  uploadAccessoryGallery,
);
router.delete(
  "/accessories/:id/gallery",
  validate(idParamSchema, "params"),
  validate(deleteGalleryImageSchema),
  deleteAccessoryGalleryImage,
);
router.patch(
  "/accessories/:id/gallery/order",
  validate(idParamSchema, "params"),
  validate(reorderGallerySchema),
  reorderAccessoryGallery,
);

export { router as adminCatalogRouter };
