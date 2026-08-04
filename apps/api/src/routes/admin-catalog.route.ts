import { Router } from "express";
import {
  archiveAccessory,
  createAccessory,
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
  deleteBikeGalleryImage,
  getAdminBike,
  listAdminBikes,
  reorderBikeGallery,
  replaceBikeSpecGroups,
  restoreBike,
  updateBike,
  uploadBikeGallery,
} from "../controllers/bike.controller.js";
import { createCategoryController } from "../controllers/category.controller.js";
import { protect, restrictTo, uploadImages, validate } from "../middlewares/index.js";
import { accessoryCategoryService } from "../services/accessory-category.service.js";
import { bikeCategoryService } from "../services/bike-category.service.js";
import {
  adminProductListQuerySchema,
  categoryListQuerySchema,
  createAccessorySchema,
  createBikeSchema,
  createCategorySchema,
  deleteGalleryImageSchema,
  idParamSchema,
  reorderGallerySchema,
  replaceSpecGroupsSchema,
  updateAccessorySchema,
  updateBikeSchema,
  updateCategorySchema,
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

const bikeCategories = createCategoryController(bikeCategoryService, { plural: "Categorías de bicicletas" });
const accessoryCategories = createCategoryController(accessoryCategoryService, {
  plural: "Categorías de accesorios",
});

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
}

mountCategoryRoutes("/bike-categories", bikeCategories);
mountCategoryRoutes("/accessory-categories", accessoryCategories);

// --- Bikes ---------------------------------------------------------------

router.get("/bikes", validate(adminProductListQuerySchema, "query"), listAdminBikes);
router.post("/bikes", validate(createBikeSchema), createBike);
router.get("/bikes/:id", validate(idParamSchema, "params"), getAdminBike);
router.patch("/bikes/:id", validate(idParamSchema, "params"), validate(updateBikeSchema), updateBike);

router.post("/bikes/:id/archive", validate(idParamSchema, "params"), archiveBike);
router.post("/bikes/:id/restore", validate(idParamSchema, "params"), restoreBike);

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
