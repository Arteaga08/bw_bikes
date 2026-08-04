import { generate } from "otplib";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createAdminUser } from "./helpers/factories.js";
import { cookieHeader, parseCookies } from "./helpers/cookies.js";

const BASE = "/api/v1/auth";
const ADMIN_PASSWORD = "Correct-Horse-Admin-1";

describe("admin login requires TOTP 2FA end to end", () => {
  it("enrolls, logs in with a code, and self-locks on disable", async () => {
    const app = buildApp();
    const email = "owner@example.com";
    await createAdminUser({ email, password: ADMIN_PASSWORD, role: "admin" });

    // Step 1: password alone never yields a session for an admin.
    const loginRes = await request(app).post(`${BASE}/login`).send({ email, password: ADMIN_PASSWORD });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.twoFactorRequired).toBe(true);
    expect(loginRes.body.data.enrolled).toBe(false);
    const challengeCookies = parseCookies(loginRes);
    expect(challengeCookies["bw_2fa_challenge"]).toBeTruthy();
    expect(challengeCookies["bw_access"]).toBeUndefined();

    // Step 2: start enrollment using the challenge cookie from login.
    const startRes = await request(app)
      .post(`${BASE}/2fa/enroll/start`)
      .set("Cookie", cookieHeader(challengeCookies));
    expect(startRes.status).toBe(200);
    const secret = startRes.body.data.secret as string;
    expect(secret).toBeTruthy();
    expect(startRes.body.data.otpauthUrl).toContain("otpauth://");

    // Step 3: complete enrollment with a real TOTP code — this both
    // activates 2FA and issues the first session.
    const codeForEnroll = await generate({ secret });
    const completeRes = await request(app)
      .post(`${BASE}/2fa/enroll/complete`)
      .set("Cookie", cookieHeader(challengeCookies))
      .send({ totpCode: codeForEnroll });
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.user.twoFactorEnabled).toBe(true);
    const sessionCookies = parseCookies(completeRes);
    expect(sessionCookies["bw_access"]).toBeTruthy();

    const meRes = await request(app).get(`${BASE}/me`).set("Cookie", cookieHeader(sessionCookies));
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.role).toBe("admin");

    // Disabling 2FA requires a valid code — a wrong one is rejected...
    const wrongDisable = await request(app)
      .post(`${BASE}/2fa/disable`)
      .set("Cookie", cookieHeader(sessionCookies))
      .send({ totpCode: "000000" });
    expect(wrongDisable.status).toBe(401);

    // ...but a valid one succeeds.
    const codeForDisable = await generate({ secret });
    const disableRes = await request(app)
      .post(`${BASE}/2fa/disable`)
      .set("Cookie", cookieHeader(sessionCookies))
      .send({ totpCode: codeForDisable });
    expect(disableRes.status).toBe(200);

    // Disabling immediately invalidates the admin's own in-flight session
    // — `protect` requires twoFactor.enabled for every admin request, not
    // just at login (see middlewares/protect.ts).
    const meAfterDisable = await request(app).get(`${BASE}/me`).set("Cookie", cookieHeader(sessionCookies));
    expect(meAfterDisable.status).toBe(401);

    // The next login is forced back through enrollment, not a bare
    // password login.
    const loginAgain = await request(app).post(`${BASE}/login`).send({ email, password: ADMIN_PASSWORD });
    expect(loginAgain.body.data.twoFactorRequired).toBe(true);
    expect(loginAgain.body.data.enrolled).toBe(false);
  });

  it("logs in an already-enrolled admin via /2fa/verify", async () => {
    const app = buildApp();
    const email = "owner2@example.com";
    await createAdminUser({ email, password: ADMIN_PASSWORD, role: "superadmin" });

    const loginRes = await request(app).post(`${BASE}/login`).send({ email, password: ADMIN_PASSWORD });
    const challengeCookies = parseCookies(loginRes);
    const startRes = await request(app)
      .post(`${BASE}/2fa/enroll/start`)
      .set("Cookie", cookieHeader(challengeCookies));
    const secret = startRes.body.data.secret as string;
    await request(app)
      .post(`${BASE}/2fa/enroll/complete`)
      .set("Cookie", cookieHeader(challengeCookies))
      .send({ totpCode: await generate({ secret }) });

    // Fresh login, now enrolled: password step should say `enrolled: true`
    // and the second step goes through /2fa/verify, not /2fa/enroll/*.
    const secondLogin = await request(app).post(`${BASE}/login`).send({ email, password: ADMIN_PASSWORD });
    expect(secondLogin.body.data.enrolled).toBe(true);
    const secondChallenge = parseCookies(secondLogin);

    const verifyRes = await request(app)
      .post(`${BASE}/2fa/verify`)
      .set("Cookie", cookieHeader(secondChallenge))
      .send({ totpCode: await generate({ secret }) });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.user.role).toBe("superadmin");
    expect(parseCookies(verifyRes)["bw_access"]).toBeTruthy();
  });
});
