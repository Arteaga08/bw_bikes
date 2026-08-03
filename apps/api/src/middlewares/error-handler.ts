import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError } from "../utils/index.js";

interface NormalizedError {
  statusCode: number;
  message: string;
  isOperational: boolean;
}

/** Maps well-known error types (Mongoose, JWT, Multer) to an operational AppError. */
function normalize(err: unknown): NormalizedError {
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, message: err.message, isOperational: true };
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const message = Object.values(err.errors)
      .map((e) => e.message)
      .join("; ");
    return { statusCode: 400, message, isOperational: true };
  }

  if (err instanceof mongoose.Error.CastError) {
    return { statusCode: 400, message: `Identificador inválido: ${err.value}`, isOperational: true };
  }

  if (err && typeof err === "object" && "code" in err && (err as { code?: number }).code === 11000) {
    return { statusCode: 409, message: "El recurso ya existe.", isOperational: true };
  }

  if (err instanceof Error && (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError")) {
    return { statusCode: 401, message: "Sesión inválida o expirada.", isOperational: true };
  }

  // http-errors-style errors from Express/body-parser itself (e.g. a
  // PayloadTooLargeError from express.json({limit}) exceeding its cap) carry
  // `statusCode` + `expose: true` by convention — surface those as the
  // operational client error they are instead of masking them as a 500.
  if (
    err &&
    typeof err === "object" &&
    "statusCode" in err &&
    "expose" in err &&
    (err as { expose?: unknown }).expose === true &&
    typeof (err as { statusCode?: unknown }).statusCode === "number"
  ) {
    const statusCode = (err as { statusCode: number }).statusCode;
    if (statusCode === 413) {
      return { statusCode, message: "El cuerpo de la solicitud es demasiado grande.", isOperational: true };
    }
    return { statusCode, message: "Solicitud inválida.", isOperational: true };
  }

  return { statusCode: 500, message: "Algo salió mal.", isOperational: false };
}

/**
 * Global 4-arg error handler — the single place errors are turned into a
 * response. Never leaks stack traces or internal details in production;
 * unexpected (non-operational) errors are logged with full detail but
 * returned to the client as a generic message.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const normalized = normalize(err);

  if (!normalized.isOperational) {
    logger.error({ err, path: req.originalUrl, method: req.method }, "Unexpected error");
  }

  const body: { status: "fail" | "error"; message: string; stack?: string } = {
    status: normalized.statusCode < 500 ? "fail" : "error",
    message: normalized.statusCode < 500 || normalized.isOperational ? normalized.message : "Algo salió mal.",
  };

  if (!env.isProduction && err instanceof Error) {
    body.stack = err.stack;
  }

  res.status(normalized.statusCode).json(body);
}
