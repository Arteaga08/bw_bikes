import { env } from "./env.js";

/**
 * Single source of truth for the origin whitelist, shared by CORS (config/cors.ts)
 * and the anti-CSRF middleware (middlewares/verify-origin.ts) so they can never
 * drift apart. Localhost origins are only present outside production.
 */
export const allowedOrigins: readonly string[] = env.isProduction
  ? [env.clientUrl]
  : [env.clientUrl, "http://localhost:3000", "http://127.0.0.1:3000"];
