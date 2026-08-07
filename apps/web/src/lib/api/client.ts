import { API_BASE_PATH } from "../config";
import { ApiError, NETWORK_ERROR_MESSAGE } from "./error";
import { parseApiResponse, type ParsedResponse } from "./parse-response";

/**
 * Browser-side API client. Paths are relative (`/api/v1/...`) and same-origin
 * by construction — `next.config.ts`'s rewrite is what makes that true, and
 * it's what lets the browser send the API's `HttpOnly` cookies without ever
 * needing `credentials: "include"` (same-origin requests carry cookies by
 * default). No CORS negotiation ever happens on this path.
 */
export async function apiFetch<TData = unknown>(path: string, init?: RequestInit): Promise<ParsedResponse<TData>> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_PATH}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0);
  }

  return parseApiResponse<TData>(res);
}
