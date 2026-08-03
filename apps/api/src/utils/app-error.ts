/**
 * Operational error with an explicit HTTP status. Thrown anywhere in
 * services/controllers; normalized into a response by the global error
 * handler (middlewares/error-handler.ts). `isOperational: true` marks it as
 * an expected error (bad input, not found, conflict...) as opposed to a bug.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational = true;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}
