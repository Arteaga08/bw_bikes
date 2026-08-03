/**
 * Single response envelope used by every endpoint in the API.
 * Controllers never build the JSON response by hand — they always go through
 * `sendResponse` (apps/api/src/utils/send-response.ts), which produces this shape.
 */
export interface ApiResponse<TData = unknown> {
  status: "success" | "fail" | "error";
  message: string;
  data?: TData;
  meta?: ApiResponseMeta;
}

/** Pagination metadata attached to list endpoints. */
export interface ApiResponseMeta {
  total: number;
  page: number;
  pages: number;
  limit: number;
}
