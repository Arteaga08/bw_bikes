import { API_BASE_PATH, apiInternalUrl } from "../config";
import { ApiError, NETWORK_ERROR_MESSAGE } from "./error";
import { parseApiResponse, type ParsedResponse } from "./parse-response";

/**
 * Server-side fetch for the anonymous storefront (M12, entrega 2 — the home
 * hero is the first caller). Deliberately **not** `serverApiFetch`:
 *
 * - That one forwards the incoming request's cookies and redirects to
 *   `/admin/login` on a 401. Neither makes sense on a public page — an
 *   anonymous visitor has no admin session to forward, and a content
 *   endpoint returning an unexpected 401 is a bug to surface, not a reason
 *   to send a shopper to the admin login screen.
 * - That one always sets `cache: "no-store"`, right for admin data that must
 *   never be stale. Public content is the opposite: the home hero changes
 *   rarely, so this uses `next: { revalidate }` instead, which is what lets
 *   the home page stay static/ISR rather than becoming dynamic on every
 *   visit.
 *
 * A failure here is handled by the caller, not thrown past it — see
 * `HomeHero.tsx`'s fallback. The storefront must never show a blank page or
 * an error screen because a content fetch failed.
 */
export async function publicApiFetch<TData = unknown>(
  path: string,
  options: { revalidateSeconds?: number } = {},
): Promise<ParsedResponse<TData>> {
  const revalidate = options.revalidateSeconds ?? 300;

  let res: Response;
  try {
    res = await fetch(`${apiInternalUrl()}${API_BASE_PATH}${path}`, {
      next: { revalidate },
    });
  } catch {
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0);
  }

  return parseApiResponse<TData>(res);
}
