import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/index.js";

/**
 * Mounted after all routers; turns any unmatched path into a 404 AppError.
 * Generic message, deliberately not `req.originalUrl` — reflecting arbitrary
 * client input back into a response is a needless reflection point, even one
 * `nosniff` + a `default-src 'none'` CSP already mitigate.
 */
export function notFound(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError("Ruta no encontrada.", 404));
}
