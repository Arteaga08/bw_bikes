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

/**
 * Server-only: the Cloudinary cloud name, needed to turn an order line
 * snapshot's `imagePublicId` (`packages/shared`'s `buildImageUrl`) into a
 * displayable URL. Every other image the storefront renders already arrives
 * as a full URL from the API — this is the one place a `publicId` reaches
 * `apps/web` bare, because `OrderLineSnapshot` freezes only the id so order
 * history keeps rendering after a product is edited or archived.
 */
export function cloudinaryCloudName(): string {
  const name = process.env["CLOUDINARY_CLOUD_NAME"];
  if (!name) {
    throw new Error("Missing required environment variable: CLOUDINARY_CLOUD_NAME");
  }
  return name;
}

// Mirrors apps/api/src/utils/cookies.ts — names only, never values.
export const ACCESS_TOKEN_COOKIE = "bw_access";

export const LOGIN_PATH = "/admin/login";
export const FORBIDDEN_PATH = "/admin/sin-acceso";
export const PANEL_HOME_PATH = "/admin";

export const CUSTOMER_LOGIN_PATH = "/ingresar";
export const CUSTOMER_REGISTER_PATH = "/crear-cuenta";
export const ACCOUNT_PATH = "/mi-cuenta";
export const ACCOUNT_PROFILE_PATH = "/mi-cuenta/perfil";
