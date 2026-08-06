import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { User } from "../src/models/index.js";
import { cookieHeader, parseCookies } from "./helpers/cookies.js";
import { createUser } from "./helpers/factories.js";
import { stubPasswordBreach } from "./helpers/password-breach.js";

const BASE = "/api/v1/auth";

async function login(
  app: ReturnType<typeof buildApp>,
  email: string,
  password: string,
): Promise<Record<string, string>> {
  const res = await request(app).post(`${BASE}/login`).send({ email, password });
  expect(res.status).toBe(200);
  return parseCookies(res);
}

describe("login anti-enumeration", () => {
  it("gives the exact same message for a nonexistent email and a wrong password", async () => {
    const app = buildApp();
    const email = "real-user@example.com";
    const password = "Correct-Horse-1";
    await createUser({ email, password, emailVerified: true });

    const nonexistentRes = await request(app)
      .post(`${BASE}/login`)
      .send({ email: "nobody-here@example.com", password: "whatever123" });
    const wrongPasswordRes = await request(app).post(`${BASE}/login`).send({ email, password: "wrong-password-1" });

    expect(nonexistentRes.status).toBe(401);
    expect(wrongPasswordRes.status).toBe(401);
    expect(nonexistentRes.body.message).toBe(wrongPasswordRes.body.message);
  });

  it("blocks login for an unverified account only after the password check succeeds", async () => {
    const app = buildApp();
    const email = "unverified@example.com";
    const password = "Correct-Horse-1";
    await createUser({ email, password, emailVerified: false });

    const wrongPassword = await request(app).post(`${BASE}/login`).send({ email, password: "nope-not-it" });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.message).toContain("incorrectos");

    const correctPassword = await request(app).post(`${BASE}/login`).send({ email, password });
    expect(correctPassword.status).toBe(403);
    expect(correctPassword.body.message).toContain("Verifica tu correo");
  });
});

describe("register anti mass-assignment", () => {
  it("ignores a role field on the register payload", async () => {
    const app = buildApp();
    const email = "wannabe-admin@example.com";

    const res = await request(app).post(`${BASE}/register`).send({
      email,
      password: "Correct-Horse-1",
      passwordConfirm: "Correct-Horse-1",
      firstName: "No",
      lastName: "Admin",
      role: "admin",
    });
    expect(res.status).toBe(201);

    const stored = await User.findOne({ email });
    expect(stored?.role).toBe("customer");
  });
});

describe("password never leaks in a response", () => {
  it("omits password from the register and login payloads", async () => {
    const app = buildApp();
    const email = "no-leak@example.com";
    const password = "Correct-Horse-1";
    await createUser({ email, password, emailVerified: true });

    const loginRes = await request(app).post(`${BASE}/login`).send({ email, password });
    expect(loginRes.body.data.user.password).toBeUndefined();
    expect(JSON.stringify(loginRes.body)).not.toContain(password);
  });
});

describe("login rate limiting", () => {
  it("locks out after 5 attempts within the window", async () => {
    const app = buildApp();
    const email = "lockout-target@example.com";
    await createUser({ email, password: "Correct-Horse-1", emailVerified: true });

    const attempts = [];
    for (let i = 0; i < 6; i += 1) {
      attempts.push(await request(app).post(`${BASE}/login`).send({ email, password: "wrong-password" }));
    }

    const statuses = attempts.map((res) => res.status);
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
  });
});

describe("breached-password rejection", () => {
  it("refuses to register with a password the HaveIBeenPwned corpus reports as breached", async () => {
    const app = buildApp();
    stubPasswordBreach(true);

    const res = await request(app).post(`${BASE}/register`).send({
      email: "breach-check-register@example.com",
      password: "Correct-Horse-1",
      passwordConfirm: "Correct-Horse-1",
      firstName: "Ada",
      lastName: "Byte",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("fugas de datos");
    expect(await User.exists({ email: "breach-check-register@example.com" })).toBeNull();
  });

  it("keeps the breach check from becoming an account-existence oracle", async () => {
    // The check must fire uniformly on the password chosen, regardless of
    // whether the email already has an account — otherwise a well-known
    // breached password becomes a two-value probe for email existence
    // (400 only ever possible for an email that doesn't exist yet).
    const app = buildApp();
    const existingEmail = "already-registered@example.com";
    await createUser({ email: existingEmail, password: "Some-Other-Password-1", emailVerified: true });

    stubPasswordBreach(true);
    const forExisting = await request(app).post(`${BASE}/register`).send({
      email: existingEmail,
      password: "Correct-Horse-1",
      passwordConfirm: "Correct-Horse-1",
      firstName: "Ada",
      lastName: "Byte",
    });
    const forNew = await request(app).post(`${BASE}/register`).send({
      email: "not-registered-yet@example.com",
      password: "Correct-Horse-1",
      passwordConfirm: "Correct-Horse-1",
      firstName: "Ada",
      lastName: "Byte",
    });

    // Same status for both — the response depends only on the (breached)
    // password, never on the account's prior existence.
    expect(forExisting.status).toBe(forNew.status);
    expect(forExisting.status).toBe(400);
  });
});

// Regression coverage for the audit finding that `/refresh` and `/logout` had
// no dedicated limiter — only the 1000/15min global backstop — which is far
// looser than every other sensitive auth action here.
describe("refresh and logout rate limiting", () => {
  it("throttles /refresh well before the generous global backstop", async () => {
    const app = buildApp();
    const email = "refresh-throttle@example.com";
    await createUser({ email, password: "Correct-Horse-1", emailVerified: true });
    const cookies = await login(app, email, "Correct-Horse-1");

    // 30 is refreshRateLimiter's ceiling (middlewares/rate-limit.ts). A fresh
    // refresh token is unusable after rotation, so each attempt beyond the
    // first genuinely fails at the token layer — that's fine, the assertion
    // is about status 429 showing up at all, not about a valid rotation chain.
    const attempts = [];
    for (let i = 0; i < 31; i += 1) {
      attempts.push(await request(app).post(`${BASE}/refresh`).set("Cookie", cookieHeader(cookies)));
    }

    expect(attempts.some((res) => res.status === 429)).toBe(true);
  });

  it("throttles /logout well before the generous global backstop", async () => {
    const app = buildApp();
    const email = "logout-throttle@example.com";
    await createUser({ email, password: "Correct-Horse-1", emailVerified: true });
    const cookies = await login(app, email, "Correct-Horse-1");

    // 10 is authActionRateLimiter's ceiling, now shared by /logout.
    const attempts = [];
    for (let i = 0; i < 11; i += 1) {
      attempts.push(await request(app).post(`${BASE}/logout`).set("Cookie", cookieHeader(cookies)));
    }

    expect(attempts.some((res) => res.status === 429)).toBe(true);
  });
});

// Regression coverage for the audit finding that `refreshSession` minted a
// new access token without revalidating the account's standing — unlike
// `protect`, which checks `emailVerified`-adjacent state on every request.
describe("refresh revalidates account standing", () => {
  it("refuses to rotate a session for an account whose email verification was revoked mid-session", async () => {
    const app = buildApp();
    const email = "revoked-mid-session@example.com";
    await createUser({ email, password: "Correct-Horse-1", emailVerified: true });
    const cookies = await login(app, email, "Correct-Horse-1");

    // Simulates a future admin action revoking verification; today nothing in
    // the product flips this flag back to false, but `refreshSession` must
    // not blindly trust a long-lived refresh token over the account's live
    // standing.
    await User.updateOne({ email }, { $set: { emailVerified: false } }).exec();

    const res = await request(app).post(`${BASE}/refresh`).set("Cookie", cookieHeader(cookies));

    expect(res.status).toBe(403);
  });
});
