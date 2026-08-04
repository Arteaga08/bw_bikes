import type { UserRole } from "@bw-bikes/shared";
import type { Request, Response } from "express";
import { recordAuditLog } from "../services/audit-log.service.js";
import {
  completeAdminTwoFactorEnrollment,
  completeAdminTwoFactorLogin,
  forgotPassword,
  getUserById,
  logout as logoutSession,
  logoutAll,
  loginWithPassword,
  refreshSession,
  registerUser,
  resendVerificationEmail,
  resetPassword,
  toAuthUser,
  verifyEmail,
} from "../services/auth.service.js";
import { type SessionMeta, verifyChallengeToken } from "../services/token.service.js";
import { disableTwoFactor, startTwoFactorEnrollment } from "../services/two-factor.service.js";
import {
  AppError,
  asyncHandler,
  clearSessionCookies,
  clearTwoFactorChallengeCookie,
  REFRESH_TOKEN_COOKIE,
  sendResponse,
  setSessionCookies,
  setTwoFactorChallengeCookie,
  TWO_FACTOR_CHALLENGE_COOKIE,
} from "../utils/index.js";

// Identical wording for every "we won't confirm whether this account
// exists" endpoint (resend-verification, forgot-password) — a differently
// worded response per endpoint would itself be a fingerprinting signal.
const GENERIC_ACK_MESSAGE = "Si el correo existe en nuestro sistema, recibirás instrucciones en breve.";

function sessionMeta(req: Request): SessionMeta {
  return { ip: req.ip, userAgent: req.get("user-agent") };
}

function requireUser(req: Request): { id: string; role: UserRole } {
  if (!req.user) {
    throw new AppError("No autenticado.", 401);
  }
  return req.user;
}

/** Every 2FA step (enroll start/complete, login verify) reads the same short-lived challenge cookie `login` issued. */
function readChallengeCookie(req: Request): string {
  const token = req.cookies?.[TWO_FACTOR_CHALLENGE_COOKIE] as string | undefined;
  if (!token) {
    throw new AppError("Sesión de verificación inválida o expirada.", 401);
  }
  return token;
}

function readRefreshCookie(req: Request): string | undefined {
  return req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, firstName, lastName } = req.body as {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  };
  await registerUser({ email, password, firstName, lastName });
  sendResponse(res, 201, "Registro exitoso. Revisa tu correo para verificar tu cuenta.");
});

export const verifyEmailHandler = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.body as { token: string };
  await verifyEmail(token);
  sendResponse(res, 200, "Correo verificado. Ya puedes iniciar sesión.");
});

export const resendVerification = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  await resendVerificationEmail(email);
  sendResponse(res, 200, GENERIC_ACK_MESSAGE);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  const outcome = await loginWithPassword(email, password, sessionMeta(req));

  if (outcome.kind === "two_factor_required") {
    setTwoFactorChallengeCookie(res, outcome.challengeToken);
    sendResponse(
      res,
      200,
      outcome.enrolled
        ? "Ingresa tu código de autenticación."
        : "Configura la autenticación de dos factores para continuar.",
      { twoFactorRequired: true, enrolled: outcome.enrolled },
    );
    return;
  }

  setSessionCookies(res, outcome.accessToken, outcome.refreshToken);
  sendResponse(res, 200, "Inicio de sesión exitoso.", { user: toAuthUser(outcome.user) });
});

export const startTwoFactorEnrollmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = verifyChallengeToken(readChallengeCookie(req), "2fa_enroll");

  const user = await getUserById(userId);
  if (!user) {
    throw new AppError("Sesión de verificación inválida o expirada.", 401);
  }

  const setup = await startTwoFactorEnrollment(userId, user.email);
  sendResponse(res, 200, "Escanea el código con tu aplicación de autenticación.", setup);
});

export const completeTwoFactorEnrollmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const challengeToken = readChallengeCookie(req);
  const { totpCode } = req.body as { totpCode: string };

  const result = await completeAdminTwoFactorEnrollment(challengeToken, totpCode, sessionMeta(req));

  clearTwoFactorChallengeCookie(res);
  setSessionCookies(res, result.accessToken, result.refreshToken);
  sendResponse(res, 200, "Autenticación de dos factores activada.", { user: toAuthUser(result.user) });
});

export const verifyTwoFactorHandler = asyncHandler(async (req: Request, res: Response) => {
  const challengeToken = readChallengeCookie(req);
  const { totpCode } = req.body as { totpCode: string };

  const result = await completeAdminTwoFactorLogin(challengeToken, totpCode, sessionMeta(req));

  clearTwoFactorChallengeCookie(res);
  setSessionCookies(res, result.accessToken, result.refreshToken);
  sendResponse(res, 200, "Inicio de sesión exitoso.", { user: toAuthUser(result.user) });
});

export const disableTwoFactorHandler = asyncHandler(async (req: Request, res: Response) => {
  const { id: userId } = requireUser(req);
  const { totpCode } = req.body as { totpCode: string };

  await disableTwoFactor(userId, totpCode);
  await recordAuditLog({
    actorId: userId,
    actorType: "user",
    action: "admin.two_factor_disabled",
    module: "auth",
    ip: req.ip,
  });

  sendResponse(res, 200, "Autenticación de dos factores desactivada. Vuelve a iniciar sesión para reactivarla.");
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const rawRefreshToken = readRefreshCookie(req);
  if (!rawRefreshToken) {
    throw new AppError("Sesión inválida o expirada.", 401);
  }

  const result = await refreshSession(rawRefreshToken, sessionMeta(req));
  setSessionCookies(res, result.accessToken, result.refreshToken);
  sendResponse(res, 200, "Sesión renovada.", { user: toAuthUser(result.user) });
});

export const logoutHandler = asyncHandler(async (req: Request, res: Response) => {
  await logoutSession(readRefreshCookie(req));
  clearSessionCookies(res);
  sendResponse(res, 200, "Sesión cerrada.");
});

export const logoutAllHandler = asyncHandler(async (req: Request, res: Response) => {
  const { id: userId } = requireUser(req);
  await logoutAll(userId);
  clearSessionCookies(res);
  sendResponse(res, 200, "Todas las sesiones fueron cerradas.");
});

export const forgotPasswordHandler = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  await forgotPassword(email);
  sendResponse(res, 200, GENERIC_ACK_MESSAGE);
});

export const resetPasswordHandler = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body as { token: string; password: string };
  await resetPassword(token, password);
  sendResponse(res, 200, "Contraseña actualizada. Ya puedes iniciar sesión.");
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const { id: userId } = requireUser(req);
  const user = await getUserById(userId);
  if (!user) {
    throw new AppError("Sesión inválida o expirada.", 401);
  }
  sendResponse(res, 200, "OK", { user: toAuthUser(user) });
});
