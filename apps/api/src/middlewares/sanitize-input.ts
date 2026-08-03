import type { NextFunction, Request, Response } from "express";
import { filterXSS } from "xss";

// Fields that carry a secret/credential value: never XSS-escape these, or the
// secret itself gets altered and legitimate logins/tokens start failing.
const CREDENTIAL_FIELDS = new Set(["password", "passwordConfirm", "token", "currentPassword", "newPassword"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeInPlace(target: unknown): void {
  if (Array.isArray(target)) {
    for (const item of target) sanitizeInPlace(item);
    return;
  }
  if (!isPlainObject(target)) return;

  for (const key of Object.keys(target)) {
    const value = target[key];
    if (typeof value === "string") {
      if (CREDENTIAL_FIELDS.has(key)) continue;
      target[key] = filterXSS(value);
    } else {
      sanitizeInPlace(value);
    }
  }
}

/**
 * Recursive XSS sanitization of every string field in body/params/query,
 * skipping credential fields so the secret itself is never mutated. Note:
 * this middleware sits behind express.json(), so it never sees
 * multipart/form-data fields — routes that accept file uploads + free text
 * (e.g. ambassador applications) sanitize explicitly after `validate`.
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  sanitizeInPlace(req.body);
  sanitizeInPlace(req.params);
  sanitizeInPlace(req.query);
  next();
}
