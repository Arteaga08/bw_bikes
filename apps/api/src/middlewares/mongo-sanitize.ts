import type { NextFunction, Request, Response } from "express";

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Recursively strips any key that starts with "$" or contains "." (blocks
 * NoSQL operator injection like `{"email": {"$gt": ""}}`) and any prototype
 * pollution vector (`__proto__`, `constructor`, `prototype`).
 *
 * Mutates the object in place rather than reassigning it — required because
 * in Express 5 `req.query` is a read-only getter, so `req.query = ...` throws.
 */
function sanitizeInPlace(target: unknown): void {
  if (!isPlainObject(target) && !Array.isArray(target)) return;

  if (Array.isArray(target)) {
    for (const item of target) sanitizeInPlace(item);
    return;
  }

  for (const key of Object.keys(target)) {
    if (DANGEROUS_KEYS.has(key) || key.startsWith("$") || key.includes(".")) {
      delete target[key];
      continue;
    }
    sanitizeInPlace(target[key]);
  }
}

export function mongoSanitize(req: Request, _res: Response, next: NextFunction): void {
  sanitizeInPlace(req.body);
  sanitizeInPlace(req.params);
  sanitizeInPlace(req.query);
  next();
}
