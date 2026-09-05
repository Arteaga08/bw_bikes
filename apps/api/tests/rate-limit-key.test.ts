import type { Request } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { CLIENT_IP_HEADER, PROXY_TOKEN_HEADER, normalizeIpKey, resolveClientKey } from "../src/utils/client-ip.js";

// Matches vitest.config.ts's PROXY_SHARED_SECRET fixture.
const PROXY_SECRET = "test-proxy-shared-secret-fixture-at-least-32-chars";

function fakeRequest(headers: Record<string, string | string[]>, remoteAddress?: string): Request {
  return { headers, socket: { remoteAddress } } as unknown as Request;
}

describe("normalizeIpKey", () => {
  it("returns an IPv4 address unchanged", () => {
    expect(normalizeIpKey("203.0.113.7")).toBe("203.0.113.7");
  });

  it("unwraps an IPv4-mapped IPv6 address", () => {
    expect(normalizeIpKey("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });

  it("collapses IPv6 addresses to their /64 prefix", () => {
    // A single subscriber usually controls the whole /64, so every address in
    // it has to land in one bucket or the limiter is trivially outrun.
    const first = normalizeIpKey("2001:db8:abcd:1234:0:0:0:1");
    const second = normalizeIpKey("2001:db8:abcd:1234:ffff:ffff:ffff:ffff");

    expect(first).toBe("2001:db8:abcd:1234::/64");
    expect(second).toBe(first);
  });

  it("treats a different /64 as a different key", () => {
    expect(normalizeIpKey("2001:db8:abcd:1234::1")).not.toBe(normalizeIpKey("2001:db8:abcd:9999::1"));
  });

  it("expands elided IPv6 addresses before slicing", () => {
    expect(normalizeIpKey("::1")).toBe("0:0:0:0::/64");
  });

  it("falls back to the raw value for anything unparseable", () => {
    expect(normalizeIpKey("not:an:ip:::x")).toBe("not:an:ip:::x");
  });
});

describe("resolveClientKey", () => {
  it("ignores X-Forwarded-For entirely", () => {
    const key = resolveClientKey(fakeRequest({ "x-forwarded-for": "9.9.9.9" }, "203.0.113.7"));

    expect(key).toBe("203.0.113.7");
  });

  it("believes the forwarded client IP when the proxy token matches", () => {
    const key = resolveClientKey(
      fakeRequest({ [PROXY_TOKEN_HEADER]: PROXY_SECRET, [CLIENT_IP_HEADER]: "198.51.100.4" }, "10.0.0.1"),
    );

    expect(key).toBe("198.51.100.4");
  });

  it("falls back to the socket address when the proxy token is wrong", () => {
    const key = resolveClientKey(
      fakeRequest({ [PROXY_TOKEN_HEADER]: "not-the-secret", [CLIENT_IP_HEADER]: "198.51.100.4" }, "10.0.0.1"),
    );

    expect(key).toBe("10.0.0.1");
  });

  it("ignores a repeated (array-valued) client IP header", () => {
    const key = resolveClientKey(
      fakeRequest({ [PROXY_TOKEN_HEADER]: PROXY_SECRET, [CLIENT_IP_HEADER]: ["198.51.100.4", "9.9.9.9"] }, "10.0.0.1"),
    );

    expect(key).toBe("10.0.0.1");
  });
});

describe("Rate limiting under X-Forwarded-For spoofing", () => {
  /**
   * The regression this whole change exists for. `trust proxy` is enabled
   * explicitly here to reproduce production: that is the setting that makes
   * `req.ip` read from the client-controlled X-Forwarded-For, and keying the
   * limiters on `req.ip` made login's 5/15min ceiling unlimited.
   */
  it("still throttles when every request carries a different forged X-Forwarded-For", async () => {
    const app = buildApp();
    app.set("trust proxy", 1);

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .set("X-Forwarded-For", `9.9.9.${attempt}`)
        .send({ email: "nobody@example.com", password: "irrelevant" });
      statuses.push(response.status);
    }

    expect(statuses.at(-1)).toBe(429);
  });

  it("keeps separate buckets for genuinely different clients behind the proxy", async () => {
    const app = buildApp();

    // Six requests, all from one socket, but the proxy vouches for six
    // different real clients — none of them should be throttled.
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .set(PROXY_TOKEN_HEADER, PROXY_SECRET)
        .set(CLIENT_IP_HEADER, `198.51.100.${attempt}`)
        .send({ email: "nobody@example.com", password: "irrelevant" });
      statuses.push(response.status);
    }

    expect(statuses).not.toContain(429);
  });
});
