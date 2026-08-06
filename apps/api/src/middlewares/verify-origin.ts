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

  const header = req.headers.origin ?? req.headers.referer;
  if (!header) {
    next();
    return;
  }

  // Parsed and compared as an exact origin (scheme + host + port), never by
  // string prefix: `startsWith` would let `https://midominio.com.evil.com`
  // through for an allowed `https://midominio.com`, since the attacker's host
  // simply *starts with* the legitimate one. A Referer carries a full URL
  // (path and query included), so it is normalized to its origin the same way
  // before comparing.
  const origin = parseOrigin(header);
  const isAllowed = origin !== null && allowedOrigins.some((allowed) => origin === parseOrigin(allowed));
  if (!isAllowed) {
    next(new AppError("Origen no permitido", 403));
    return;
  }

  next();
}

/** `null` for a header that isn't a parseable absolute URL — treated as not allowed, never as a pass-through. */
function parseOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}
