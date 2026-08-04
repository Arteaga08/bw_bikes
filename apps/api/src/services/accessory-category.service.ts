import { Accessory, AccessoryCategory } from "../models/index.js";
import { createCategoryService } from "./category.service.js";

/** The accessory category tree — see `bike-category.service.ts` for the shape of this pairing. */
export const accessoryCategoryService = createCategoryService(
  AccessoryCategory,
  Accessory,
  "catalog.accessory-categories",
);
