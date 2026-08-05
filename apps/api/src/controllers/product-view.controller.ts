import type { ProductViewInput } from "@bw-bikes/shared";
import type { Request, Response } from "express";
import { productViewService } from "../services/product-view.service.js";
import { asyncHandler, sendResponse } from "../utils/index.js";

/**
 * Always the same response, whether the id was real or not — see
 * `product-view.service.ts`'s `recordView` for why. `202`, not `200`/`201`:
 * this is a fire-and-forget analytics event with no resource for the client
 * to address afterward, and "accepted" is honest about the fact that the
 * caller cannot tell from the response whether anything was actually
 * persisted.
 */
export const recordProductView = asyncHandler(async (req: Request, res: Response) => {
  await productViewService.recordView(req.body as ProductViewInput);
  sendResponse(res, 202, "Solicitud procesada.");
});
