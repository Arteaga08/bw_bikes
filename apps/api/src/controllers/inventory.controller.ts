import type { Request, Response } from "express";
import type { AdjustStockInput, CreateInventoryItemInput } from "../services/inventory.service.js";
import { inventoryService } from "../services/inventory.service.js";
import { asyncHandler, routeParam, sendResponse } from "../utils/index.js";
import { requireActor } from "./category.controller.js";

export const listInventory = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await inventoryService.listItems(req.query);
  sendResponse(res, 200, "Inventario obtenido.", { items }, meta);
});

/** Mounted ahead of `/inventory/:id` — a fixed segment must win over the wildcard param, same reasoning as `/orders/summary`. */
export const getInventorySummary = asyncHandler(async (_req: Request, res: Response) => {
  const summary = await inventoryService.getSummary();
  sendResponse(res, 200, "Resumen de inventario obtenido.", { summary });
});

export const getInventoryItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await inventoryService.findByIdOrFail(routeParam(req, "id"));
  sendResponse(res, 200, "Entrada de inventario obtenida.", { item: await inventoryService.toEnrichedAdminItem(item) });
});

export const createInventoryItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await inventoryService.createItem(req.body as CreateInventoryItemInput, requireActor(req));
  sendResponse(res, 201, "Entrada de inventario creada.", { item: await inventoryService.toEnrichedAdminItem(item) });
});

export const adjustInventoryStock = asyncHandler(async (req: Request, res: Response) => {
  const item = await inventoryService.adjustStock(
    routeParam(req, "id"),
    req.body as AdjustStockInput,
    requireActor(req),
  );
  sendResponse(res, 200, "Stock actualizado.", { item: await inventoryService.toEnrichedAdminItem(item) });
});
