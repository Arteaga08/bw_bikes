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

/**
 * Server-only: shared secret this app stamps on every request it proxies to
 * the API (`app/api/v1/[...path]/route.ts`), so the API can tell "arrived
 * through our own proxy, the accompanying client-IP header is genuine" from
 * "arrived some other way, don't trust anything it claims about its origin."
 * Must equal `apps/api`'s `PROXY_SHARED_SECRET` exactly — see that file's
 * `config/env.ts` for the full reasoning.
 *
 * Unlike `apiInternalUrl()` and `stripePublishableKey()`, a missing value
 * here does not throw. `apps/api` already treats an absent secret as "trust
 * nothing this request claims about its origin, key rate limits on the raw
 * socket address instead" rather than as a fatal error (required only to
 * *boot* in production, per its `config/env.ts`) — mirroring that here, in
 * this app's *runtime* rather than its startup, means an environment missing
 * this one hardening var degrades to that same safe fallback instead of
 * turning every proxied request into a 500.
 */
export function proxySharedSecret(): string {
  return process.env["PROXY_SHARED_SECRET"] ?? "";
}

/**
 * Browser-side: Stripe.js needs the publishable key in the client to
 * tokenize card details without the card ever reaching our server (PCI
 * SAQ-A). Unlike `apiInternalUrl()`, this one **must** be `NEXT_PUBLIC_*` —
 * it is a browser value by definition, not a topology leak.
 */
export function stripePublishableKey(): string {
  const key = process.env["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"];
  if (!key) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  }
  return key;
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
