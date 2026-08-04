import type { UserRole } from "@bw-bikes/shared";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/index.js";

/** Always mounted after `protect`, which is what populates `req.user`. */
export function restrictTo(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError("No tienes permiso para realizar esta acción.", 403));
      return;
    }
    next();
  };
}
