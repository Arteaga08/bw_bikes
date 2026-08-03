import cors, { type CorsOptions } from "cors";
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
    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
};

export const corsMiddleware = cors(corsOptions);
