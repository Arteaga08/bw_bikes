import type { ItemType } from "@bw-bikes/shared";
import type { Request, Response } from "express";
import { inventoryProductsService } from "../services/inventory-products.service.js";
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

/**
 * The product-first list `/admin/inventario` renders — one row per product,
 * not per SKU. Also mounted ahead of `/inventory/:id`, same reasoning as
 * `/inventory/summary` above: `/inventory/products` has the same segment
 * count as the wildcard route and would otherwise be read as a lookup for
 * the item whose id is literally "products".
 */
export const listInventoryProducts = asyncHandler(async (req: Request, res: Response) => {
  const { products, counts, meta } = await inventoryProductsService.listProducts(req.query);
  sendResponse(res, 200, "Productos de inventario obtenidos.", { products, counts }, meta);
});

export const getInventoryProduct = asyncHandler(async (req: Request, res: Response) => {
  const itemType = req.query["itemType"] as ItemType;
  const product = await inventoryProductsService.getProductDetail(itemType, routeParam(req, "id"));
  sendResponse(res, 200, "Producto de inventario obtenido.", { product });
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

export const getPublicAvailability = asyncHandler(async (req: Request, res: Response) => {
  const itemType = req.query["itemType"] as ItemType;
  const itemIds = (req.query["itemIds"] as string).split(",");
  const availability = await inventoryService.getPublicAvailability(itemType, itemIds);
  sendResponse(res, 200, "Disponibilidad obtenida.", { availability });
});
