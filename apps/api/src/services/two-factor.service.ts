import { generateSecret, generateURI, verify } from "otplib";
import { TOTP_ISSUER } from "../config/auth.js";
import { User } from "../models/index.js";
import { AppError } from "../utils/app-error.js";
import { decryptSecret, encryptSecret } from "../utils/crypto.js";

// ±1 time step (30s each way) of clock-drift tolerance — wide enough for a
// phone clock that's slightly off, narrow enough that a code is still only
// valid for a short window.
const EPOCH_TOLERANCE_SECONDS = 30;

export interface TwoFactorSetup {
  /** Base32 plaintext secret — returned once, for the admin to load into an authenticator app. */
  secret: string;
  otpauthUrl: string;
}

/**
 * Step 1 of the two-step activation (BACKEND_SECURITY_GUIDELINES.md §2):
 * generates a fresh TOTP secret and persists it encrypted with
 * `enabled: false` ("pending"). 2FA is not active yet — only
 * `completeTwoFactorEnrollment` can flip that on, and only after proving
 * the admin can generate a valid code with this secret.
 */
export async function startTwoFactorEnrollment(userId: string, accountEmail: string): Promise<TwoFactorSetup> {
  const secret = generateSecret();
  const otpauthUrl = generateURI({ issuer: TOTP_ISSUER, label: accountEmail, secret });

  await User.updateOne(
    { _id: userId },
    { $set: { "twoFactor.secret": encryptSecret(secret), "twoFactor.enabled": false } },
  );

  return { secret, otpauthUrl };
}

/** Step 2: requires a currently-valid code before enrollment actually activates. */
export async function completeTwoFactorEnrollment(userId: string, code: string): Promise<void> {
  const user = await User.findById(userId).select("+twoFactor.secret");
  if (!user?.twoFactor.secret) {
    throw new AppError("No hay una inscripción de 2FA en curso.", 400);
  }

  const isValid = await verifyCode(user.twoFactor.secret, code);
  if (!isValid) {
    throw new AppError("Código de verificación incorrecto.", 401);
  }

  user.twoFactor.enabled = true;
  user.twoFactor.enrolledAt = new Date();
  await user.save();
}

/** Used at login (2fa/verify) and before disabling 2FA — both require a currently enabled, valid code. */
export async function verifyTwoFactorCode(userId: string, code: string): Promise<boolean> {
  const user = await User.findById(userId).select("+twoFactor.secret");
  if (!user?.twoFactor.enabled || !user.twoFactor.secret) return false;
  return verifyCode(user.twoFactor.secret, code);
}

/**
 * Disabling also requires a valid TOTP, not just an authenticated session
 * (BACKEND_SECURITY_GUIDELINES.md §2), so a stolen access-token cookie
 * alone can't turn off an admin's second factor. Clears the secret
 * entirely (not just `enabled: false`) so re-enrollment always starts
 * from a fresh secret, never a stale one that only needed a flag flipped.
 */
export async function disableTwoFactor(userId: string, code: string): Promise<void> {
  const isValid = await verifyTwoFactorCode(userId, code);
  if (!isValid) {
    throw new AppError("Código de verificación incorrecto.", 401);
  }

  await User.updateOne({ _id: userId }, { $set: { "twoFactor.enabled": false }, $unset: { "twoFactor.secret": "" } });
}

async function verifyCode(encryptedSecret: string, code: string): Promise<boolean> {
  const secret = decryptSecret(encryptedSecret);
  const result = await verify({ secret, token: code, epochTolerance: EPOCH_TOLERANCE_SECONDS });
  return result.valid;
}
