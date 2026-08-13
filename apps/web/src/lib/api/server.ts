import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiInternalUrl, API_BASE_PATH, LOGIN_PATH } from "../config";
import { ApiError, NETWORK_ERROR_MESSAGE } from "./error";
import { parseApiResponse, type ParsedResponse } from "./parse-response";

/**
 * Server-side API client — used from Server Components/layouts (the session
 * guard, initial data fetches). `next.config.ts`'s rewrite only applies to
 * requests the *browser* sends to this Next server; a `fetch` made from
 * server code never goes through it, so this talks to `API_URL` directly.
 *
 * Because it bypasses the browser, the incoming request's cookies aren't
 * attached automatically either — they're read via `next/headers` and
 * forwarded explicitly as a `Cookie` header. Always `cache: "no-store"`:
 * every call here is either auth-sensitive or needs to see the current
 * state, never a cached one (FRONTEND_GUIDELINES.md §2).
 *
 * A 401 outside `/auth/*` means the access token expired *after* the panel
 * layout's own `requireAdminSession()` already passed — that guard runs once
 * per layout mount, not on every client-side navigation between sibling
 * pages, so a page's own data fetch (this function, called directly from
 * e.g. `EditarBicicletaPage`) can legitimately outlive it. Server Components
 * can't set cookies to attempt the same silent-refresh-and-retry `apiFetch`
 * does client-side (refresh tokens rotate on use — a refresh call here with
 * no way to persist the new cookie would burn the rotation and strand the
 * browser's session), so the safe move is the same one `requireAdminSession`
 * already takes on its own failure: send the browser back to login. `/auth/*`
 * itself is excluded so `requireAdminSession`'s own `serverApiFetch("/auth/me")`
 * keeps throwing a catchable error instead of redirecting out from under it —
 * it already applies its own redirect after inspecting the failure.
 */
export async function serverApiFetch<TData = unknown>(
  path: string,
  init?: RequestInit,
): Promise<ParsedResponse<TData>> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  let res: Response;
  try {
    res = await fetch(`${apiInternalUrl()}${API_BASE_PATH}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0);
  }

  if (res.status === 401 && !path.startsWith("/auth/")) {
    redirect(LOGIN_PATH);
  }

  return parseApiResponse<TData>(res);
}
