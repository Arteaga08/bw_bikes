import type { CookieOptions, Response } from "express";
import { TWO_FACTOR_CHALLENGE_TTL_MS } from "../config/auth.js";
import { env } from "../config/env.js";
import { parseDurationMs } from "./duration.js";

/**
 * Cookie names, centralized so `protect`, the auth controller, and tests
 * all agree on them.
 */
export const ACCESS_TOKEN_COOKIE = "bw_access";
export const REFRESH_TOKEN_COOKIE = "bw_refresh";
export const TWO_FACTOR_CHALLENGE_COOKIE = "bw_2fa_challenge";

// Refresh and 2FA-challenge cookies are scoped to the auth router — the
// browser only ever attaches them on requests that actually need them
// (refresh, logout, 2FA verify/enroll), not on every request the way the
// access cookie is.
const AUTH_ROUTE_PATH = "/api/v1/auth";

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "strict",
  };
}

/**
 * Sets the access + refresh cookie pair that makes up a full session.
 * Called on register-with-auto-login-after-verify (not applicable — M2
 * requires verification first), login (non-admin, or admin after 2FA), and
 * refresh (after rotation).
 */
export function setSessionCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    ...baseCookieOptions(),
    path: "/",
    maxAge: parseDurationMs(env.jwtAccessExpiresIn),
  });
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...baseCookieOptions(),
    path: AUTH_ROUTE_PATH,
    maxAge: parseDurationMs(env.jwtRefreshExpiresIn),
  });
}

/** Overwrites both session cookies with an empty, already-expired value — logout. */
export function clearSessionCookies(res: Response): void {
  res.cookie(ACCESS_TOKEN_COOKIE, "", { ...baseCookieOptions(), path: "/", maxAge: 0 });
  res.cookie(REFRESH_TOKEN_COOKIE, "", { ...baseCookieOptions(), path: AUTH_ROUTE_PATH, maxAge: 0 });
}

/**
 * Sets the short-lived challenge cookie issued after an admin's password
 * check succeeds but before their TOTP code is verified — never a full
 * session on its own (see `protect`, which never accepts this cookie).
 */
export function setTwoFactorChallengeCookie(res: Response, challengeToken: string): void {
  res.cookie(TWO_FACTOR_CHALLENGE_COOKIE, challengeToken, {
    ...baseCookieOptions(),
    path: AUTH_ROUTE_PATH,
    maxAge: TWO_FACTOR_CHALLENGE_TTL_MS,
  });
}

export function clearTwoFactorChallengeCookie(res: Response): void {
  res.cookie(TWO_FACTOR_CHALLENGE_COOKIE, "", { ...baseCookieOptions(), path: AUTH_ROUTE_PATH, maxAge: 0 });
}
