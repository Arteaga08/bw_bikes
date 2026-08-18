import { BikeSizeTemplate } from "../models/index.js";
import { createSizeTemplateService } from "./size-template.service.js";

/**
 * The bike size catalog. Independent from the accessory catalog — its own
 * collection, its own `value` uniqueness scope, its own endpoint — sharing
 * only the CRUD engine and its rules.
 */
export const bikeSizeTemplateService = createSizeTemplateService(BikeSizeTemplate, "catalog.bike-size-templates");
