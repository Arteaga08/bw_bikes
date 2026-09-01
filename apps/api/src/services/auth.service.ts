import type { AuthUser, UserRole } from "@bw-bikes/shared";
import bcrypt from "bcryptjs";
import { BCRYPT_SALT_ROUNDS, EMAIL_VERIFICATION_TOKEN_TTL_MS, PASSWORD_RESET_TOKEN_TTL_MS } from "../config/auth.js";
import { env } from "../config/env.js";
import { type IUser, User } from "../models/index.js";
import { AppError, generateToken, hashToken } from "../utils/index.js";
import { recordAuditLog } from "./audit-log.service.js";
import { createMailer } from "./mailer/index.js";
import {
  type ChallengePurpose,
  issueSession,
  revokeAllSessions,
  revokeSession,
  rotateRefreshToken,
  type SessionMeta,
  signAccessToken,
  signChallengeToken,
  verifyChallengeToken,
} from "./token.service.js";
import { completeTwoFactorEnrollment, verifyTwoFactorCode } from "./two-factor.service.js";
import { passwordBreachService } from "./password-breach.service.js";

const BREACHED_PASSWORD_MESSAGE =
  "Esta contraseña ha aparecido en fugas de datos conocidas. Elige una diferente.";

export type LoginOutcome =
  | { kind: "session"; user: IUser; accessToken: string; refreshToken: string }
  | { kind: "two_factor_required"; challengeToken: string; enrolled: boolean };

export interface SessionResult {
  user: IUser;
  accessToken: string;
  refreshToken: string;
}

function isAdminRole(role: UserRole): boolean {
  return role === "admin" || role === "superadmin";
}

// A precomputed hash to run `bcrypt.compare` against when no user matches
// the given email, so a nonexistent-email login takes the same time as a
// wrong-password one — without this, timing alone would let an attacker
// tell the two apart despite the identical error message.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= bcrypt.hash("dummy-password-for-timing-parity", BCRYPT_SALT_ROUNDS);
  return dummyHashPromise;
}

async function issueEmailVerification(user: IUser): Promise<void> {
  const rawToken = generateToken();
  user.emailVerification = {
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS),
  };
  await user.save();

  const verifyUrl = `${env.clientUrl}/verificar-correo?token=${rawToken}`;
  await createMailer().sendVerificationEmail({ to: user.email, firstName: user.firstName, verifyUrl });
}

async function establishSession(user: IUser, meta: SessionMeta): Promise<SessionResult> {
  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = signAccessToken({ id: String(user._id), role: user.role });
  const session = await issueSession(String(user._id), meta);

  return { user, accessToken, refreshToken: session.token };
}

/**
 * Anti-enumeration by design: registering with an email that already
 * exists resolves exactly like a fresh registration — same response, same
 * timing shape — but creates nothing and sends nothing. The controller
 * always replies 201 with the same generic message either way.
 *
 * The breach check runs **before** the existing-email lookup, and its
 * outcome is the only thing that can turn this into a 400 — deliberately,
 * so the response depends only on the password an attacker chose, never on
 * whether the email they probed already has an account. Checking it after
 * the early-return would have made a well-known breached password (trivial
 * for an attacker to pick on purpose) a two-value oracle for account
 * existence: 400 only ever possible for an email that doesn't exist yet.
 */
export async function registerUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<void> {
  if (await passwordBreachService.isBreached(input.password)) {
    throw new AppError(BREACHED_PASSWORD_MESSAGE, 400);
  }

  const email = input.email.toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (existing) return;

  const user = await User.create({
    email,
    password: input.password,
    firstName: input.firstName,
    lastName: input.lastName,
  });

  await issueEmailVerification(user);
}

/** Single-use: the token is cleared from the user document the moment it's consumed. */
export async function verifyEmail(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  const user = await User.findOne({
    "emailVerification.tokenHash": tokenHash,
    "emailVerification.expiresAt": { $gt: new Date() },
  });

  if (!user) {
    throw new AppError("Token de verificación inválido o expirado.", 400);
  }

  user.emailVerified = true;
  user.emailVerification = undefined;
  await user.save();
}

/** Always a silent no-op for a nonexistent or already-verified email — the controller's response never varies. */
export async function resendVerificationEmail(email: string): Promise<void> {
  const user = await User.findOne({ email: email.toLowerCase().trim(), emailVerified: false });
  if (!user) return;
  await issueEmailVerification(user);
}

/** Always a silent no-op for a nonexistent email — the controller's response never varies. */
export async function forgotPassword(email: string): Promise<void> {
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) return;

  const rawToken = generateToken();
  user.passwordReset = {
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
  };
  await user.save();

  const resetUrl = `${env.clientUrl}/restablecer-contrasena?token=${rawToken}`;
  await createMailer().sendPasswordResetEmail({ to: user.email, firstName: user.firstName, resetUrl });
}

/**
 * Single-use token; also revokes every existing session for the account
 * (ECOMMERCE_ARCHITECTURE_GUIDELINES.md's "cerrar todas las sesiones al
 * resetear") — a leaked old session shouldn't survive a password reset.
 * Does not auto-login: the user signs in again with the new password.
 */
export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  const user = await User.findOne({
    "passwordReset.tokenHash": tokenHash,
    "passwordReset.expiresAt": { $gt: new Date() },
  });

  if (!user) {
    throw new AppError("Token de restablecimiento inválido o expirado.", 400);
  }

  if (await passwordBreachService.isBreached(newPassword)) {
    throw new AppError(BREACHED_PASSWORD_MESSAGE, 400);
  }

  user.password = newPassword;
  user.passwordReset = undefined;
  await user.save();

  await revokeAllSessions(String(user._id));
}

/**
 * Password check first, `emailVerified` second — deliberately, so only
 * someone who already proved the password is correct learns that the
 * account exists but isn't verified yet. Admin/superadmin never receive a
 * session here: password success only earns a short-lived 2FA challenge
 * (`kind: "two_factor_required"`) — see completeAdminTwoFactorLogin /
 * completeAdminTwoFactorEnrollment for the step that actually issues one.
 */
export async function loginWithPassword(email: string, password: string, meta: SessionMeta): Promise<LoginOutcome> {
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");

  const candidateHash = user ? user.password : await getDummyHash();
  const passwordMatches = await bcrypt.compare(password, candidateHash);
  if (!user || !passwordMatches) {
    throw new AppError("Email o contraseña incorrectos.", 401);
  }

  if (!user.emailVerified) {
    throw new AppError("Verifica tu correo antes de iniciar sesión.", 403);
  }

  if (isAdminRole(user.role)) {
    const purpose: ChallengePurpose = user.twoFactor.enabled ? "2fa_challenge" : "2fa_enroll";
    const challengeToken = signChallengeToken(String(user._id), purpose);
    return { kind: "two_factor_required", challengeToken, enrolled: user.twoFactor.enabled };
  }

  const session = await establishSession(user, meta);
  return { kind: "session", ...session };
}

/** Second step of an already-enrolled admin's login: challenge cookie + valid TOTP → session. */
export async function completeAdminTwoFactorLogin(
  challengeToken: string,
  code: string,
  meta: SessionMeta,
): Promise<SessionResult> {
  const { userId } = verifyChallengeToken(challengeToken, "2fa_challenge");

  const isValid = await verifyTwoFactorCode(userId, code);
  if (!isValid) {
    throw new AppError("Código de verificación incorrecto.", 401);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("Sesión de verificación inválida o expirada.", 401);
  }

  const result = await establishSession(user, meta);
  await recordAuditLog({ actorId: user._id, actorType: "user", action: "admin.login", module: "auth", ip: meta.ip });
  return result;
}

/** Second step of a first-time admin login: challenge cookie + valid TOTP against the pending secret → activates 2FA and issues a session. */
export async function completeAdminTwoFactorEnrollment(
  challengeToken: string,
  code: string,
  meta: SessionMeta,
): Promise<SessionResult> {
  const { userId } = verifyChallengeToken(challengeToken, "2fa_enroll");

  await completeTwoFactorEnrollment(userId, code);

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("Sesión de verificación inválida o expirada.", 401);
  }

  const result = await establishSession(user, meta);
  await recordAuditLog({
    actorId: user._id,
    actorType: "user",
    action: "admin.two_factor_enrolled",
    module: "auth",
    ip: meta.ip,
  });
  return result;
}

/**
 * Rotates the refresh token and mints a fresh access token — but only for an
 * account still in good standing. `protect` already revalidates `emailVerified`
 * indirectly (nothing before that middleware requires it, and every mutating
 * route runs behind it), but nothing previously stopped `refresh` itself from
 * handing a **new** access token to an account whose email verification was
 * revoked after the original login — the rotated refresh token would keep
 * minting valid sessions until it expired on its own (up to
 * `JWT_REFRESH_EXPIRES_IN`), rather than the access token's much shorter
 * `JWT_ACCESS_EXPIRES_IN`.
 */
export async function refreshSession(rawRefreshToken: string, meta: SessionMeta): Promise<SessionResult> {
  const rotated = await rotateRefreshToken(rawRefreshToken, meta);
  if (!rotated) {
    throw new AppError("Sesión inválida o expirada.", 401);
  }

  const user = await User.findById(rotated.userId);
  if (!user) {
    throw new AppError("Sesión inválida o expirada.", 401);
  }

  if (!user.emailVerified) {
    throw new AppError("Verifica tu correo antes de iniciar sesión.", 403);
  }

  const accessToken = signAccessToken({ id: String(user._id), role: user.role });
  return { user, accessToken, refreshToken: rotated.session.token };
}

export async function logout(rawRefreshToken: string | undefined): Promise<void> {
  if (!rawRefreshToken) return;
  await revokeSession(rawRefreshToken);
}

export async function logoutAll(userId: string): Promise<void> {
  await revokeAllSessions(userId);
}

export async function getUserById(userId: string): Promise<IUser | null> {
  return User.findById(userId);
}

/** Maps the internal Mongoose document to the public shape defined in `@bw-bikes/shared`. */
export function toAuthUser(user: IUser): AuthUser {
  return {
    id: String(user._id),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    emailVerified: user.emailVerified,
    twoFactorEnabled: user.twoFactor.enabled,
    createdAt: user.createdAt.toISOString(),
  };
}
