import { cookies } from "next/headers";
import { apiInternalUrl, API_BASE_PATH } from "../config";
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

  return parseApiResponse<TData>(res);
}
