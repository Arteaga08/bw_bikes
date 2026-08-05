import type {
  ApplicationsSettings,
  InventorySettings,
  JobsSettings,
  OrdersSettings,
  PricingSettings,
  ShippingSettings,
} from "@bw-bikes/shared";
import type { Request, Response } from "express";
import { settingsService } from "../services/settings.service.js";
import { asyncHandler, sendResponse } from "../utils/index.js";
import { requireActor } from "./category.controller.js";

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await settingsService.get();
  sendResponse(res, 200, "Configuración obtenida.", { settings });
});

/** One handler per section, each pinned to its own key — never a generic `updateSettings(section)` dispatcher, so a typo in a route can't reach the wrong writer. */

export const updateInventorySettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await settingsService.updateSection(
    "inventory",
    req.body as InventorySettings,
    { actorType: "user", ...requireActor(req) },
  );
  sendResponse(res, 200, "Configuración de inventario actualizada.", { settings });
});

export const updateOrdersSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await settingsService.updateSection("orders", req.body as OrdersSettings, {
    actorType: "user",
    ...requireActor(req),
  });
  sendResponse(res, 200, "Configuración de órdenes actualizada.", { settings });
});

export const updatePricingSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await settingsService.updateSection("pricing", req.body as PricingSettings, {
    actorType: "user",
    ...requireActor(req),
  });
  sendResponse(res, 200, "Configuración de precios actualizada.", { settings });
});

export const updateShippingSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await settingsService.updateSection("shipping", req.body as ShippingSettings, {
    actorType: "user",
    ...requireActor(req),
  });
  sendResponse(res, 200, "Configuración de envíos actualizada.", { settings });
});

export const updateApplicationsSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await settingsService.updateSection(
    "applications",
    req.body as ApplicationsSettings,
    { actorType: "user", ...requireActor(req) },
  );
  sendResponse(res, 200, "Configuración de solicitudes actualizada.", { settings });
});

export const updateJobsSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await settingsService.updateSection("jobs", req.body as JobsSettings, {
    actorType: "user",
    ...requireActor(req),
  });
  sendResponse(res, 200, "Configuración de tareas programadas actualizada.", { settings });
});
