import type { NextFunction, Request, Response } from "express";
import { allowedOrigins } from "../config/allowed-origins.js";
import { AppError } from "../utils/index.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Defense-in-depth anti-CSRF check, on top of the primary defense
 * (`sameSite: "strict"` on the auth cookie). On mutating methods, rejects
 * requests whose Origin (or Referer as fallback) isn't in the whitelist.
 * Requests without either header (server-to-server calls, CLI, health
 * checks) are allowed through — they aren't browser CSRF attacks, and auth
 * still applies downstream.
 */
export function verifyOrigin(req: Request, _res: Response, next: NextFunction): void {
  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }

  const origin = req.headers.origin ?? req.headers.referer;
  if (!origin) {
    next();
    return;
  }

  const isAllowed = allowedOrigins.some((allowed) => origin.startsWith(allowed));
  if (!isAllowed) {
    next(new AppError("Origen no permitido", 403));
    return;
  }

  next();
}
