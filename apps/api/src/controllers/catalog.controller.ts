import type { Request, Response } from "express";
import { toPublicAccessory } from "../services/accessory.service.js";
import { toPublicBike } from "../services/bike.service.js";
import { onSaleService } from "../services/on-sale.service.js";
import { asyncHandler, sendResponse } from "../utils/index.js";

/**
 * The storefront's "Ofertas" listing — bikes and accessories with a real
 * discount, merged into one paginated result (`on-sale.service.ts`). `order`
 * carries this page's real interleaved bike/accessory sequence; `bikes`/
 * `accessories` are the same public DTOs the plain catalog endpoints ship.
 */
export const listPublicOnSale = asyncHandler(async (req: Request, res: Response) => {
  const { bikes, accessories, order, meta } = await onSaleService.listOnSale(req.query);
  sendResponse(
    res,
    200,
    "Productos en oferta obtenidos.",
    { bikes: bikes.map(toPublicBike), accessories: accessories.map(toPublicAccessory), order },
    meta,
  );
});
