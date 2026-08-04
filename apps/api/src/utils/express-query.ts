import type { Request } from "express";
import { AppError } from "./app-error.js";

/**
 * Turns `req.query` into a plain own data property so it can be mutated.
 *
 * In Express 5 `req.query` is a **getter** on the request prototype that
 * re-runs the configured query parser on every access. That makes it look
 * writable while silently discarding writes: deleting a key from `req.query`
 * and reading it back returns the key again, freshly re-parsed from the URL.
 *
 * Three middlewares in this codebase mutate `req.query` in place —
 * `mongoSanitize` (strips `$`/`.` operator keys), `sanitizeInput` (XSS) and
 * `validate` (Joi `stripUnknown`) — and all three were therefore no-ops on the
 * query string, however correct their own logic was. The consequence is not
 * cosmetic: a NoSQL operator injected via `?category[$ne]=` would have reached
 * a service's filter object unsanitized once query-driven list endpoints
 * existed (M3 is the first milestone that has them).
 *
 * Defining an own property shadows the prototype getter for the rest of the
 * request, after which the three middlewares behave exactly as their code
 * reads. Called once, at the head of the chain, from `mongoSanitize`.
 */
export function materializeQuery(req: Request): void {
  const descriptor = Object.getOwnPropertyDescriptor(req, "query");
  // Already materialized (or Express changed shape) — nothing to do.
  if (descriptor?.value !== undefined) return;

  Object.defineProperty(req, "query", {
    value: { ...req.query },
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

/**
 * Reads a route param as a plain string.
 *
 * Express 5 types `req.params` values as `string | string[]` because a wildcard
 * segment can repeat. None of this API's routes declare one, and every `:id` /
 * `:slug` has already been shape-checked by `validate(schema, "params")` before
 * a controller runs — so an array here means a route was mounted with a pattern
 * nobody intended, which is a bug worth surfacing rather than coercing away.
 */
export function routeParam(req: Request, name: string): string {
  const value = req.params[name];

  if (typeof value !== "string") {
    throw new AppError("Identificador inválido.", 400);
  }
  return value;
}
