import { API_BASE_PATH, LOGIN_PATH } from "../config";
import { ApiError, NETWORK_ERROR_MESSAGE } from "./error";
import { parseApiResponse, type ParsedResponse } from "./parse-response";

function withJsonHeaders(init: RequestInit | undefined, isFormData: boolean): RequestInit {
  // A `FormData` body (the gallery upload) must NOT get an explicit
  // `Content-Type` — the browser sets its own `multipart/form-data; boundary=…`
  // only when it owns the header. Forcing `application/json` on it, as every
  // other call here needs, would send a body the server can't parse.
  return {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  };
}

/**
 * One refresh in flight at a time, shared by every caller that hits a 401
 * around the same moment — same "one promise in flight" collapse
 * `settingsService.get()` already uses on the backend (M7) for concurrent
 * reads.
 */
let refreshInFlight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE_PATH}/auth/refresh`, { method: "POST" })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/**
 * A 401 outside `/auth/*` means the 15-minute access token expired
 * mid-session, not that the request itself was wrong — `POST /auth/refresh`
 * has existed since M2 (refresh-token rotation) but nothing in the panel ever
 * called it until M10.2, so any admin working more than 15 minutes started
 * hitting 401 on every write. This refreshes once and retries the original
 * request; a failed refresh means the session is genuinely over (the 30-day
 * refresh token expired, or its family got revoked) and sends the browser to
 * login. `/auth/*` itself is excluded — a wrong password or TOTP code
 * legitimately responds 401 and must not trigger a pointless refresh attempt.
 */
async function fetchWithRefresh(path: string, init: RequestInit | undefined, isFormData: boolean): Promise<Response> {
  const requestInit = withJsonHeaders(init, isFormData);
  const res = await fetch(`${API_BASE_PATH}${path}`, requestInit);

  if (res.status !== 401 || path.startsWith("/auth/")) {
    return res;
  }

  const refreshed = await refreshSession();
  if (!refreshed) {
    window.location.href = LOGIN_PATH;
    // Navigation is async — never resolve so nothing downstream acts on a
    // response that belongs to a page that's already leaving.
    return new Promise<Response>(() => {});
  }

  // One retry, raw — a second 401 here is real and should surface as-is, not
  // loop back into another refresh attempt. `requestInit` (including a
  // `FormData` body) is safe to reuse: it isn't a one-shot stream.
  return fetch(`${API_BASE_PATH}${path}`, requestInit);
}

/**
 * Browser-side API client. Paths are relative (`/api/v1/...`) and same-origin
 * by construction — `next.config.ts`'s rewrite is what makes that true, and
 * it's what lets the browser send the API's `HttpOnly` cookies without ever
 * needing `credentials: "include"` (same-origin requests carry cookies by
 * default). No CORS negotiation ever happens on this path.
 */
export async function apiFetch<TData = unknown>(path: string, init?: RequestInit): Promise<ParsedResponse<TData>> {
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;

  let res: Response;
  try {
    res = await fetchWithRefresh(path, init, isFormData);
  } catch {
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0);
  }

  return parseApiResponse<TData>(res);
}
