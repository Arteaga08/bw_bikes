/**
 * Thrown by both `apiFetch` (browser) and `serverApiFetch` (server) for any
 * non-success response. Carries the exact Spanish message the API already
 * produces (`error-handler.ts` never leaks a stack trace in production, so
 * `message` is always safe to render directly) plus the HTTP status, so a
 * caller can special-case 401/403 without string-matching the message.
 */
export class ApiError extends Error {
  readonly httpStatus: number;

  constructor(message: string, httpStatus: number) {
    super(message);
    this.name = "ApiError";
    this.httpStatus = httpStatus;
  }
}

/** Shown when the API is unreachable entirely (network failure, DNS, timeout) — never a raw fetch error. */
export const NETWORK_ERROR_MESSAGE = "No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.";
