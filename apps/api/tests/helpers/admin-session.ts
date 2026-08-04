import type { Express } from "express";
import { generate } from "otplib";
import request from "supertest";
import { cookieHeader, parseCookies } from "./cookies.js";
import { createAdminUser } from "./factories.js";

const AUTH_BASE = "/api/v1/auth";
const ADMIN_PASSWORD = "Correct-Horse-Admin-1";

/**
 * Produces a `Cookie` header for a fully authenticated admin.
 *
 * There is no shortcut here on purpose: `protect` re-checks
 * `twoFactor.enabled` on **every** admin request (see middlewares/protect.ts),
 * so no admin route is reachable without walking the real flow — password
 * login yields only a 5-minute challenge cookie, enrollment mints the TOTP
 * secret, and a genuine `otplib` code exchanges it for a session. Every admin
 * catalog test therefore exercises M2's auth chain for real rather than
 * forging a token.
 */
export async function createAdminSession(
  app: Express,
  options: { email?: string; role?: "admin" | "superadmin" } = {},
): Promise<string> {
  const email = options.email ?? `admin-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;

  await createAdminUser({ email, password: ADMIN_PASSWORD, role: options.role ?? "admin" });

  const loginRes = await request(app).post(`${AUTH_BASE}/login`).send({ email, password: ADMIN_PASSWORD });
  const challengeCookies = parseCookies(loginRes);

  const startRes = await request(app)
    .post(`${AUTH_BASE}/2fa/enroll/start`)
    .set("Cookie", cookieHeader(challengeCookies));
  const secret = startRes.body.data.secret as string;

  const completeRes = await request(app)
    .post(`${AUTH_BASE}/2fa/enroll/complete`)
    .set("Cookie", cookieHeader(challengeCookies))
    .send({ totpCode: await generate({ secret }) });

  return cookieHeader(parseCookies(completeRes));
}

/** A logged-in storefront customer — used to prove admin routes reject non-admin roles. */
export async function createCustomerSession(app: Express, email = "customer@example.com"): Promise<string> {
  const password = "Correct-Horse-Customer-1";
  const { createUser } = await import("./factories.js");
  await createUser({ email, password, role: "customer" });

  const loginRes = await request(app).post(`${AUTH_BASE}/login`).send({ email, password });
  return cookieHeader(parseCookies(loginRes));
}
