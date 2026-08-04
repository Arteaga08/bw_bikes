import { Bike, BikeCategory } from "../models/index.js";
import { createCategoryService } from "./category.service.js";

/**
 * The bike category tree. Independent from the accessory tree in every way
 * that matters — its own collection, its own slug namespace, its own
 * endpoints — sharing only the CRUD engine and its rules.
 */
export const bikeCategoryService = createCategoryService(BikeCategory, Bike, "catalog.bike-categories");
