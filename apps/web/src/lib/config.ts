/**
 * Single source of truth for API/auth constants (FRONTEND_GUIDELINES.md §4).
 * Nothing here is a secret — the cookie names mirror
 * apps/api/src/utils/cookies.ts exactly, so the two sides can never drift.
 */

/** Prefix every API route lives under. Browser calls stay relative to this — see next.config.ts's rewrites. */
export const API_BASE_PATH = "/api/v1";

/**
 * Server-only: the real address of the API, used by the Next.js server
 * process itself (the rewrite destination, and any server-side fetch that
 * needs an absolute URL). Never exposed to the browser — there is
 * deliberately no `NEXT_PUBLIC_API_URL`.
 */
export function apiInternalUrl(): string {
  const url = process.env["API_URL"];
  if (!url) {
    throw new Error("Missing required environment variable: API_URL");
  }
  return url;
}

// Mirrors apps/api/src/utils/cookies.ts — names only, never values.
export const ACCESS_TOKEN_COOKIE = "bw_access";

export const LOGIN_PATH = "/admin/login";
export const FORBIDDEN_PATH = "/admin/sin-acceso";
export const PANEL_HOME_PATH = "/admin";
