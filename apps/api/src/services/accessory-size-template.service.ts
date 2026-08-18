import { AccessorySizeTemplate } from "../models/index.js";
import { createSizeTemplateService } from "./size-template.service.js";

/** The accessory size catalog — see `bike-size-template.service.ts` for the shape of this pairing. */
export const accessorySizeTemplateService = createSizeTemplateService(
  AccessorySizeTemplate,
  "catalog.accessory-size-templates",
);
