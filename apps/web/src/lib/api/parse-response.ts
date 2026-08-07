import type { ApiResponse, ApiResponseMeta } from "@bw-bikes/shared";
import { ApiError } from "./error";

export interface ParsedResponse<TData> {
  data: TData;
  meta?: ApiResponseMeta;
}

/**
 * Shared by `apiFetch` (browser) and `serverApiFetch` (server): both talk to
 * the same `ApiResponse` envelope (packages/shared/src/types/api-response.ts)
 * and must map `fail`/`error` to `ApiError` the same way, or the two code
 * paths would silently diverge on error handling.
 */
export async function parseApiResponse<TData>(res: Response): Promise<ParsedResponse<TData>> {
  let body: ApiResponse<TData> | undefined;
  try {
    body = (await res.json()) as ApiResponse<TData>;
  } catch {
    // A non-JSON body (e.g. a proxy/hosting error page) still needs to
    // surface as an ApiError, not an unhandled SyntaxError.
    throw new ApiError("Respuesta inesperada del servidor.", res.status);
  }

  if (body.status !== "success") {
    throw new ApiError(body.message, res.status);
  }

  return { data: body.data as TData, ...(body.meta !== undefined ? { meta: body.meta } : {}) };
}
