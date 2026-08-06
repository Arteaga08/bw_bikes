import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { User } from "../src/models/index.js";
import { cookieHeader, parseCookies } from "./helpers/cookies.js";
import { createUser } from "./helpers/factories.js";
import { captureNextResetLink, extractToken } from "./helpers/mailer.js";
import { stubPasswordBreach } from "./helpers/password-breach.js";

const BASE = "/api/v1/auth";

describe("password reset", () => {
  it("rejects an invalid token", async () => {
    const app = buildApp();
    const res = await request(app)
      .post(`${BASE}/reset-password`)
      .send({ token: "f".repeat(64), password: "New-Password-1", passwordConfirm: "New-Password-1" });
    expect(res.status).toBe(400);
  });

  it("rejects an expired token", async () => {
    const app = buildApp();
    const email = "expired-token@example.com";
    await createUser({ email, password: "Old-Password-1", emailVerified: true });

    const captured = captureNextResetLink();
    await request(app).post(`${BASE}/forgot-password`).send({ email });
    const token = extractToken(captured.getUrl());

    // Force the stored token into the past instead of waiting out the TTL.
    await User.updateOne({ email }, { $set: { "passwordReset.expiresAt": new Date(Date.now() - 1000) } });

    const res = await request(app)
      .post(`${BASE}/reset-password`)
      .send({ token, password: "New-Password-1", passwordConfirm: "New-Password-1" });
    expect(res.status).toBe(400);
  });

  it("is single-use, revokes existing sessions, and lets the user log in with the new password", async () => {
    const app = buildApp();
    const email = "resetter@example.com";
    const oldPassword = "Old-Password-1";
    const newPassword = "New-Password-2";
    await createUser({ email, password: oldPassword, emailVerified: true });

    // Establish a session before the reset, to prove it gets revoked.
    const loginRes = await request(app).post(`${BASE}/login`).send({ email, password: oldPassword });
    const preResetCookies = parseCookies(loginRes);

    const captured = captureNextResetLink();
    const forgotRes = await request(app).post(`${BASE}/forgot-password`).send({ email });
    expect(forgotRes.status).toBe(200);
    const token = extractToken(captured.getUrl());

    const resetRes = await request(app)
      .post(`${BASE}/reset-password`)
      .send({ token, password: newPassword, passwordConfirm: newPassword });
    expect(resetRes.status).toBe(200);

    // Single-use: the same token can't be replayed.
    const replayRes = await request(app)
      .post(`${BASE}/reset-password`)
      .send({ token, password: "Another-Password-3", passwordConfirm: "Another-Password-3" });
    expect(replayRes.status).toBe(400);

    // The pre-reset session no longer works.
    const refreshRes = await request(app)
      .post(`${BASE}/refresh`)
      .set("Cookie", cookieHeader({ bw_refresh: preResetCookies["bw_refresh"]! }));
    expect(refreshRes.status).toBe(401);

    // Old password rejected, new password accepted.
    const loginOldRes = await request(app).post(`${BASE}/login`).send({ email, password: oldPassword });
    expect(loginOldRes.status).toBe(401);

    const loginNewRes = await request(app).post(`${BASE}/login`).send({ email, password: newPassword });
    expect(loginNewRes.status).toBe(200);
  });

  it("refuses a new password the HaveIBeenPwned corpus reports as breached", async () => {
    const app = buildApp();
    const email = "breach-check-reset@example.com";
    await createUser({ email, password: "Old-Password-1", emailVerified: true });

    const captured = captureNextResetLink();
    await request(app).post(`${BASE}/forgot-password`).send({ email });
    const token = extractToken(captured.getUrl());

    stubPasswordBreach(true);
    const res = await request(app)
      .post(`${BASE}/reset-password`)
      .send({ token, password: "Correct-Horse-1", passwordConfirm: "Correct-Horse-1" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("fugas de datos");

    // The token is still live — a rejected breached password must not burn
    // the customer's one reset attempt.
    stubPasswordBreach(false);
    const retry = await request(app)
      .post(`${BASE}/reset-password`)
      .send({ token, password: "Correct-Horse-1", passwordConfirm: "Correct-Horse-1" });
    expect(retry.status).toBe(200);
  });

  it("gives the same generic response for forgot-password regardless of whether the email exists", async () => {
    const app = buildApp();
    const known = await request(app).post(`${BASE}/forgot-password`).send({ email: "unknown-1@example.com" });
    const unknown = await request(app).post(`${BASE}/forgot-password`).send({ email: "unknown-2@example.com" });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body.message).toBe(unknown.body.message);
  });
});
