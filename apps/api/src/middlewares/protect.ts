import type { NextFunction, Request, Response } from "express";
import { getUserById } from "../services/auth.service.js";
import { verifyAccessToken } from "../services/token.service.js";
import { ACCESS_TOKEN_COOKIE, AppError, asyncHandler } from "../utils/index.js";

/**
 * Verifies the access-token cookie, confirms the user still exists, and
 * rejects tokens issued before a password change (via
 * `isPasswordChangedAfter`) — a leaked old access token stops working the
 * moment the account resets its password, even though the JWT itself
 * hasn't expired yet.
 *
 * Admin/superadmin additionally require `twoFactor.enabled` on **every**
 * request, not just at login — this is what makes 2FA actually
 * obligatorio for admins rather than a one-time gate: disabling it (see
 * two-factor.service.ts's `disableTwoFactor`) invalidates any admin
 * session already in flight, forcing a fresh login + re-enrollment.
 */
export const protect = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined;
  if (!token) {
    throw new AppError("No autenticado.", 401);
  }

  const payload = verifyAccessToken(token);
  const user = await getUserById(payload.sub);
  if (!user) {
    throw new AppError("Sesión inválida o expirada.", 401);
  }

  if (user.isPasswordChangedAfter(payload.iat ?? 0)) {
    throw new AppError("Sesión inválida o expirada.", 401);
  }

  if ((user.role === "admin" || user.role === "superadmin") && !user.twoFactor.enabled) {
    throw new AppError("Sesión inválida o expirada.", 401);
  }

  req.user = { id: String(user._id), role: user.role };
  next();
});
