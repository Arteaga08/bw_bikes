import cors, { type CorsOptions } from "cors";
import { AppError } from "../utils/index.js";
import { allowedOrigins } from "./allowed-origins.js";

/**
 * CORS with an explicit whitelist (never `origin: "*"` — credentials are on,
 * so a wildcard would be rejected by browsers anyway and would be unsafe if
 * it weren't).
 */
const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Requests without an Origin header (server-to-server, curl, health checks)
    // are allowed through — CORS is a browser-enforced concept, not an auth
    // control. Auth still applies downstream.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    // An `AppError` here, not a plain `Error`: the global error handler's
    // `normalize()` only recognizes `AppError` as operational — a bare
    // `Error` fell through to its 500 branch, so every disallowed origin
    // both answered the wrong status *and* triggered `logger.error` for what
    // is really just a routine, expected rejection.
    callback(new AppError("Origen no permitido.", 403));
  },
  credentials: true,
};

export const corsMiddleware = cors(corsOptions);
