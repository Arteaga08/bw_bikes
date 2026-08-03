import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/index.js";

/** Mounted after all routers; turns any unmatched path into a 404 AppError. */
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(`Ruta no encontrada: ${req.originalUrl}`, 404));
}
