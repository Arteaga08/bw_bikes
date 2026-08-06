import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const AUTH = "/api/v1/auth";

/**
 * `verifyOrigin` (middlewares/verify-origin.ts) is defense-in-depth on top of
 * `SameSite=strict`: on a mutating request it rejects an Origin/Referer that
 * isn't in the whitelist. The allowed origin in test env is CLIENT_URL
 * (http://localhost:3000, see vitest.config.ts) plus the two localhost
 * fallbacks `allowedOrigins.ts` adds outside production.
 *
 * `logout` is used as the mutating endpoint under test because it needs no
 * session (missing cookie is a no-op success), so only the origin check is
 * exercised.
 *
 * Every case here is driven through **Referer**, not Origin: `corsMiddleware`
 * sits ahead of `verifyOrigin` in the chain (app.ts) and already rejects an
 * unrecognised *Origin* header with an exact-match check of its own
 * (`config/cors.ts`), which would make an Origin-based prefix attack fail one
 * layer too early to prove anything about `verifyOrigin` specifically. Referer
 * is not a header CORS looks at, so it is the layer that actually isolates
 * this middleware's own comparison.
 */
describe("verifyOrigin", () => {
  it("allows a request whose Referer origin exactly matches an allowed origin", async () => {
    const app = buildApp();
    const res = await request(app).post(`${AUTH}/logout`).set("Referer", "http://localhost:3000/checkout");
    expect(res.status).toBe(200);
  });

  it("rejects a request with no matching Referer", async () => {
    const app = buildApp();
    const res = await request(app).post(`${AUTH}/logout`).set("Referer", "https://evil.com/");
    expect(res.status).toBe(403);
  });

  // The prefix-match bug this fix closes: an attacker's host that merely
  // *starts with* the allowed origin's string must not pass.
  it("rejects a Referer whose host only shares a string prefix with an allowed origin", async () => {
    const app = buildApp();
    const res = await request(app)
      .post(`${AUTH}/logout`)
      .set("Referer", "http://localhost:3000.evil.com/some/path");
    expect(res.status).toBe(403);
  });

  it("allows a request with neither Origin nor Referer (server-to-server call)", async () => {
    const app = buildApp();
    const res = await request(app).post(`${AUTH}/logout`);
    expect(res.status).toBe(200);
  });

  it("does not throw on a malformed Referer header", async () => {
    const app = buildApp();
    const res = await request(app).post(`${AUTH}/logout`).set("Referer", "not-a-url");
    expect(res.status).toBe(403);
  });
});
