import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { cookieHeader, parseCookies } from "./helpers/cookies.js";
import { captureNextVerificationLink, extractToken } from "./helpers/mailer.js";

const BASE = "/api/v1/auth";

async function registerAndVerify(app: ReturnType<typeof buildApp>, email: string): Promise<void> {
  const captured = captureNextVerificationLink();
  const registerRes = await request(app)
    .post(`${BASE}/register`)
    .send({ email, password: "Correct-Horse-1", passwordConfirm: "Correct-Horse-1", firstName: "Ada", lastName: "Byte" });
  expect(registerRes.status).toBe(201);

  const token = extractToken(captured.getUrl());
  const verifyRes = await request(app).post(`${BASE}/verify-email`).send({ token });
  expect(verifyRes.status).toBe(200);
}

describe("customer auth: register -> verify -> login -> refresh -> logout", () => {
  it("completes the full happy path", async () => {
    const app = buildApp();
    const email = "customer@example.com";

    await registerAndVerify(app, email);

    const loginRes = await request(app)
      .post(`${BASE}/login`)
      .send({ email, password: "Correct-Horse-1" });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user.email).toBe(email);
    expect(loginRes.body.data.user.password).toBeUndefined();

    const sessionCookies = parseCookies(loginRes);
    expect(sessionCookies["bw_access"]).toBeTruthy();
    expect(sessionCookies["bw_refresh"]).toBeTruthy();

    const meRes = await request(app).get(`${BASE}/me`).set("Cookie", cookieHeader(sessionCookies));
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe(email);

    // Rotate the refresh token.
    const refreshRes = await request(app)
      .post(`${BASE}/refresh`)
      .set("Cookie", cookieHeader({ bw_refresh: sessionCookies["bw_refresh"]! }));
    expect(refreshRes.status).toBe(200);
    const rotatedCookies = parseCookies(refreshRes);
    expect(rotatedCookies["bw_refresh"]).toBeTruthy();
    expect(rotatedCookies["bw_refresh"]).not.toBe(sessionCookies["bw_refresh"]);

    // Reusing the now-rotated-away original refresh token is a replay
    // signal: it must fail, AND it must revoke the entire family —
    // including the token that was just issued from it.
    const reuseRes = await request(app)
      .post(`${BASE}/refresh`)
      .set("Cookie", cookieHeader({ bw_refresh: sessionCookies["bw_refresh"]! }));
    expect(reuseRes.status).toBe(401);

    const rotatedNowRevokedRes = await request(app)
      .post(`${BASE}/refresh`)
      .set("Cookie", cookieHeader({ bw_refresh: rotatedCookies["bw_refresh"]! }));
    expect(rotatedNowRevokedRes.status).toBe(401);

    // Establish a fresh session to exercise logout in isolation.
    const secondLogin = await request(app)
      .post(`${BASE}/login`)
      .send({ email, password: "Correct-Horse-1" });
    const secondCookies = parseCookies(secondLogin);

    const logoutRes = await request(app)
      .post(`${BASE}/logout`)
      .set("Cookie", cookieHeader({ bw_refresh: secondCookies["bw_refresh"]! }));
    expect(logoutRes.status).toBe(200);

    const refreshAfterLogout = await request(app)
      .post(`${BASE}/refresh`)
      .set("Cookie", cookieHeader({ bw_refresh: secondCookies["bw_refresh"]! }));
    expect(refreshAfterLogout.status).toBe(401);
  });
});
