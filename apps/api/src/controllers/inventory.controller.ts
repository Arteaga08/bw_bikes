import type { Request, Response } from "express";
import type { AdjustStockInput, CreateInventoryItemInput } from "../services/inventory.service.js";
import { inventoryService, toAdminInventoryItem } from "../services/inventory.service.js";
import { asyncHandler, routeParam, sendResponse } from "../utils/index.js";
import { requireActor } from "./category.controller.js";

export const listInventory = asyncHandler(async (req: Request, res: Response) => {
  const { documents, meta } = await inventoryService.listItems(req.query);
  sendResponse(res, 200, "Inventario obtenido.", { items: documents.map(toAdminInventoryItem) }, meta);
});

export const getInventoryItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await inventoryService.findByIdOrFail(routeParam(req, "id"));
  sendResponse(res, 200, "Entrada de inventario obtenida.", { item: toAdminInventoryItem(item) });
});

export const createInventoryItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await inventoryService.createItem(req.body as CreateInventoryItemInput, requireActor(req));
  sendResponse(res, 201, "Entrada de inventario creada.", { item: toAdminInventoryItem(item) });
});

export const adjustInventoryStock = asyncHandler(async (req: Request, res: Response) => {
  const item = await inventoryService.adjustStock(
    routeParam(req, "id"),
    req.body as AdjustStockInput,
    requireActor(req),
  );
  sendResponse(res, 200, "Stock actualizado.", { item: toAdminInventoryItem(item) });
});
