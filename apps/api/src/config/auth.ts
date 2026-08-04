/**
 * Auth constants that aren't per-environment secrets (those live in
 * `env.ts`) but business-level thresholds. Hardcoded for M2; promoted to
 * the `Settings` singleton in M7 per BACKEND_ARCHITECTURE_GUIDELINES.md
 * ("Configuración de negocio centralizada") once that mechanism exists —
 * no business threshold gets hardcoded again after that lands.
 */

/** bcrypt cost factor, per BACKEND_SECURITY_GUIDELINES.md §1. */
export const BCRYPT_SALT_ROUNDS = 12;

/**
 * Email verification and password-reset tokens are hashed at rest,
 * single-use, and short-lived (ECOMMERCE_ARCHITECTURE_GUIDELINES.md,
 * "Tokens de verificación/reset"). Verification gets a longer window since
 * it just gates first login, not an active account-takeover risk; reset is
 * more sensitive and expires sooner.
 */
export const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

/**
 * Window to complete the second step of an admin login (submit the TOTP
 * code) or of 2FA enrollment, once the password/first step already
 * succeeded. Short by design — this cookie carries a `purpose`-scoped JWT
 * that is not a full session.
 */
export const TWO_FACTOR_CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5min

/** Issuer label shown in authenticator apps when an admin scans/enters the TOTP secret. */
export const TOTP_ISSUER = "Black and White Bikes";
