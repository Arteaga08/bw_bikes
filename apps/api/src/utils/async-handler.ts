import type { NextFunction, Request, Response } from "express";

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Wraps an async controller so a rejected promise is forwarded to `next()`
 * instead of crashing the process. Every async controller goes through this —
 * no repeated try/catch per controller; the error handling lives once in the
 * global error handler.
 */
export function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
