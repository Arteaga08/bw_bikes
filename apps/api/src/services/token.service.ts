import type { UserRole } from "@bw-bikes/shared";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { TWO_FACTOR_CHALLENGE_TTL_MS } from "../config/auth.js";
import { env } from "../config/env.js";
import { Session } from "../models/index.js";
import { AppError } from "../utils/app-error.js";
import { generateToken, hashToken } from "../utils/crypto.js";
import { parseDurationMs } from "../utils/duration.js";

/**
 * Pinned explicitly on every `jwt.verify` call below. `jsonwebtoken@9` with a
 * string secret already restricts itself to an HMAC algorithm and rejects
 * `alg: none`, so this isn't closing a live hole today — but leaving
 * `algorithms` unset means that safety is incidental, riding on the current
 * library version and the secret happening to be a plain string rather than
 * an explicit contract. A key-type change (e.g. introducing an RSA/EC key
 * elsewhere in the codebase and a verify call accidentally reusing it) is
 * exactly the scenario this class of bug — algorithm confusion — comes from.
 */
const JWT_ALGORITHM = "HS256";

// ---------------------------------------------------------------------------
// Access token (short-lived JWT, cookie-carried, never persisted server-side)
// ---------------------------------------------------------------------------

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  role: UserRole;
  purpose: "access";
}

export function signAccessToken(user: { id: string; role: UserRole }): string {
  return jwt.sign({ sub: user.id, role: user.role, purpose: "access" }, env.jwtSecret, {
    expiresIn: env.jwtAccessExpiresIn as SignOptions["expiresIn"],
  });
}

/**
 * Throws `AppError(401, ...)` — via the same message the global
 * `errorHandler` already gives `JsonWebTokenError`/`TokenExpiredError`
 * (see error-handler.ts) — for a bad signature, expiry, or a token that
 * simply wasn't issued for `purpose: "access"` (e.g. a 2FA challenge token
 * presented here instead).
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret, { algorithms: [JWT_ALGORITHM] });
  if (typeof decoded === "string" || decoded["purpose"] !== "access" || typeof decoded["sub"] !== "string") {
    throw new AppError("Sesión inválida o expirada.", 401);
  }
  return decoded as AccessTokenPayload;
}

// ---------------------------------------------------------------------------
// 2FA challenge token (short-lived JWT, scoped to one step of admin login
// or 2FA enrollment — never sufficient on its own to reach `protect`)
// ---------------------------------------------------------------------------

export type ChallengePurpose = "2fa_challenge" | "2fa_enroll";

export function signChallengeToken(userId: string, purpose: ChallengePurpose): string {
  const expiresIn = `${TWO_FACTOR_CHALLENGE_TTL_MS / 1000}s` as SignOptions["expiresIn"];
  return jwt.sign({ sub: userId, purpose }, env.jwtSecret, { expiresIn });
}

export function verifyChallengeToken(token: string, expectedPurpose: ChallengePurpose): { userId: string } {
  const decoded = jwt.verify(token, env.jwtSecret, { algorithms: [JWT_ALGORITHM] });
  if (typeof decoded === "string" || decoded["purpose"] !== expectedPurpose || typeof decoded["sub"] !== "string") {
    throw new AppError("Sesión de verificación inválida o expirada.", 401);
  }
  return { userId: decoded["sub"] };
}

// ---------------------------------------------------------------------------
// Refresh sessions (opaque CSPRNG token, hashed at rest, rotated on every
// use) — the "recurso transaccional" here is the Session document itself.
// ---------------------------------------------------------------------------

export interface SessionMeta {
  ip?: string | undefined;
  userAgent?: string | undefined;
}

export interface IssuedSession {
  token: string;
  familyId: string;
  expiresAt: Date;
}

async function createSessionDocument(userId: string, familyId: string, meta: SessionMeta): Promise<IssuedSession> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + parseDurationMs(env.jwtRefreshExpiresIn));
  await Session.create({
    userId,
    tokenHash: hashToken(token),
    familyId,
    expiresAt,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return { token, familyId, expiresAt };
}

/** Starts a new session lineage (login). */
export async function issueSession(userId: string, meta: SessionMeta): Promise<IssuedSession> {
  return createSessionDocument(userId, generateToken(16), meta);
}

/**
 * Rotates a refresh token: the presented token is marked revoked +
 * `replacedBy`, and a new one is issued in the same `familyId`. Returns
 * `null` for anything that isn't a live rotation — an unknown token, an
 * expired one, or (the security-critical case) **a token that was already
 * revoked**. That last case means the same refresh token got used twice,
 * which only happens if it leaked and an attacker raced the legitimate
 * client — so instead of just rejecting this one request, the entire
 * family is revoked, killing every session descended from it.
 */
export async function rotateRefreshToken(
  rawToken: string,
  meta: SessionMeta,
): Promise<{ userId: string; session: IssuedSession } | null> {
  const tokenHash = hashToken(rawToken);
  const session = await Session.findOne({ tokenHash });
  if (!session) return null;

  if (session.revokedAt) {
    await Session.updateMany({ familyId: session.familyId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  const userId = String(session.userId);
  const next = await createSessionDocument(userId, session.familyId, meta);
  session.revokedAt = new Date();
  session.replacedBy = hashToken(next.token);
  await session.save();

  return { userId, session: next };
}

/** Logout: revokes exactly the one session tied to the presented refresh token. */
export async function revokeSession(rawToken: string): Promise<void> {
  await Session.updateOne({ tokenHash: hashToken(rawToken), revokedAt: null }, { $set: { revokedAt: new Date() } });
}

/**
 * Logout-all, and the "cerrar todas las sesiones" step of a password
 * reset (ECOMMERCE_ARCHITECTURE_GUIDELINES.md's session hardening) —
 * revokes every live session for the user regardless of family.
 */
export async function revokeAllSessions(userId: string): Promise<void> {
  await Session.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}
