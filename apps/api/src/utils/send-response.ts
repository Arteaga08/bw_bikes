import type { Response } from "express";
import type { ApiResponse, ApiResponseMeta } from "@bw-bikes/shared";

/**
 * The only place a controller builds a response body. Keeps the API contract
 * consistent across every endpoint regardless of resource.
 */
export function sendResponse<TData>(
  res: Response,
  statusCode: number,
  message: string,
  data?: TData,
  meta?: ApiResponseMeta,
): void {
  const body: ApiResponse<TData> = {
    status: statusCode < 400 ? "success" : "fail",
    message,
    ...(data !== undefined ? { data } : {}),
    ...(meta !== undefined ? { meta } : {}),
  };
  res.status(statusCode).json(body);
}
