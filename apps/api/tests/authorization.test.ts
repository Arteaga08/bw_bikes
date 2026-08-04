import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { cookieHeader, parseCookies } from "./helpers/cookies.js";
import { createUser } from "./helpers/factories.js";

const BASE = "/api/v1/auth";

describe("protect", () => {
  it("rejects a request with no session cookie", async () => {
    const app = buildApp();
    const res = await request(app).get(`${BASE}/me`);
    expect(res.status).toBe(401);
  });

  it("rejects a request with a garbage access cookie", async () => {
    const app = buildApp();
    const res = await request(app).get(`${BASE}/me`).set("Cookie", "bw_access=not-a-real-jwt");
    expect(res.status).toBe(401);
  });
});

describe("restrictTo", () => {
  it("blocks a customer from an admin-only route with 403", async () => {
    const app = buildApp();
    const email = "shopper@example.com";
    const password = "Correct-Horse-1";
    await createUser({ email, password, role: "customer" });

    const loginRes = await request(app).post(`${BASE}/login`).send({ email, password });
    expect(loginRes.status).toBe(200); // customers get a session directly, no 2FA challenge
    const cookies = parseCookies(loginRes);

    // A real admin-only route (protect + restrictTo("admin", "superadmin")),
    // not a throwaway test router.
    const res = await request(app)
      .post(`${BASE}/2fa/disable`)
      .set("Cookie", cookieHeader(cookies))
      .send({ totpCode: "123456" });
    expect(res.status).toBe(403);
  });
});
