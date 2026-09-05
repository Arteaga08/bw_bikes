import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

/**
 * Regression coverage for the P3 fix in config/cors.ts: a disallowed Origin
 * used to reach the error handler as a plain `Error`, which `normalize()`
 * only recognizes as a non-operational 500 — the wrong status for a routine,
 * expected rejection, and one that triggered `logger.error` on every hit.
 */
describe("CORS", () => {
  it("rejects a disallowed Origin with 403, not 500", async () => {
    const app = buildApp();

    const res = await request(app).get("/api/v1/health").set("Origin", "https://evil.example.com");

    expect(res.status).toBe(403);
    expect(res.body.status).toBe("fail");
  });

  it("allows the whitelisted origin through, with credentials enabled", async () => {
    const app = buildApp();

    // CLIENT_URL in test env — see vitest.config.ts.
    const res = await request(app).get("/api/v1/health").set("Origin", "http://localhost:3000");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("allows a request with no Origin header at all (server-to-server, curl)", async () => {
    const app = buildApp();

    const res = await request(app).get("/api/v1/health");

    expect(res.status).toBe(200);
  });
});
