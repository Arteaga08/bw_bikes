import { CUSTOMER_LOGIN_PATH } from "../config";

/** `/ingresar`, with `?redirect=` appended when the caller has somewhere to send the visitor back to after login. */
export function loginHref(returnTo?: string): string {
  if (!returnTo) return CUSTOMER_LOGIN_PATH;
  return `${CUSTOMER_LOGIN_PATH}?redirect=${encodeURIComponent(returnTo)}`;
}

/**
 * Validates a `?redirect=` query value before it's used as a navigation
 * target — accepts only a same-site path (`/algo`), never `//host/...` or an
 * absolute URL, which would otherwise let `?redirect=` be used as an open
 * redirect to an external host.
 */
export function safeRedirectTarget(param: string | string[] | undefined): string | null {
  const value = Array.isArray(param) ? param[0] : param;
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}
