import type { NextFunction, Request, Response } from "express";
import { materializeQuery } from "../utils/express-query.js";

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
 * in Express 5 `req.query` is a getter, so `req.query = ...` throws. See
 * `materializeQuery` for why the getter also has to be replaced first.
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
  // First middleware in the chain that touches req.query, so it's where the
  // getter gets swapped for a real object — otherwise this sanitization, and
  // every later one, would be silently discarded.
  materializeQuery(req);

  sanitizeInPlace(req.body);
  sanitizeInPlace(req.params);
  sanitizeInPlace(req.query);
  next();
}
