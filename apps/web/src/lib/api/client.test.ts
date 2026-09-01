// @vitest-environment jsdom
//
// This file otherwise matches the "node" project (src/**/*.test.ts, per
// vitest.config.ts) since `apiFetch` is pure logic — but the session-refresh
// redirect below is a real `window.location` write, so this one file needs a
// DOM. A per-file override is simpler than reclassifying `client.ts` itself
// or renaming this file to `.test.tsx` for no React content.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOGIN_PATH } from "../config";
import { apiFetch } from "./client";
import { NETWORK_ERROR_MESSAGE } from "./error";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("apiFetch", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the relative, same-origin path (no absolute API URL, no credentials override)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: 1 })));

    await apiFetch("/auth/me");

    expect(fetch).toHaveBeenCalledWith("/api/v1/auth/me", expect.anything());
  });

  it("resolves with data and meta on a success envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ status: "success", message: "OK", data: [1, 2], meta: { total: 2, page: 1, pages: 1, limit: 20 } }),
      ),
    );

    const result = await apiFetch<number[]>("/orders");
    expect(result.data).toEqual([1, 2]);
    expect(result.meta).toEqual({ total: 2, page: 1, pages: 1, limit: 20 });
  });

  it("throws ApiError with the backend's message on a fail envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ status: "fail", message: "Credenciales inválidas." }, 401)),
    );

    await expect(apiFetch("/auth/login")).rejects.toMatchObject({
      name: "ApiError",
      message: "Credenciales inválidas.",
      httpStatus: 401,
    });
  });

  it("throws ApiError with the backend's message on an error envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ status: "error", message: "Algo salió mal." }, 500)),
    );

    await expect(apiFetch("/orders")).rejects.toMatchObject({ name: "ApiError", httpStatus: 500 });
  });

  it("throws ApiError with a generic message when the network request itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(apiFetch("/auth/me")).rejects.toMatchObject({
      name: "ApiError",
      message: NETWORK_ERROR_MESSAGE,
      httpStatus: 0,
    });
  });

  // --- Session refresh (M10.2) ---------------------------------------------

  it("does not attempt a refresh for a 401 on an /auth/* path (a wrong password or TOTP code is a real 401)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ status: "fail", message: "Credenciales inválidas." }, 401));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(apiFetch("/auth/login")).rejects.toMatchObject({ httpStatus: 401 });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("refreshes the session once on a 401 outside /auth/*, then retries the original request", async () => {
    let ordersCalls = 0;
    const fetchSpy = vi.fn((url: string) => {
      if (url === "/api/v1/auth/refresh") {
        return Promise.resolve(new Response(null, { status: 200 }));
      }
      ordersCalls += 1;
      if (ordersCalls === 1) {
        return Promise.resolve(jsonResponse({ status: "fail", message: "No autenticado." }, 401));
      }
      return Promise.resolve(jsonResponse({ status: "success", message: "OK", data: [1, 2] }));
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await apiFetch<number[]>("/orders");

    expect(result.data).toEqual([1, 2]);
    expect(ordersCalls).toBe(2);
    expect(fetchSpy.mock.calls.filter((call) => call[0] === "/api/v1/auth/refresh")).toHaveLength(1);
  });

  it("sends the browser to the login page when the refresh itself fails (the refresh token is also gone)", async () => {
    const fetchSpy = vi.fn((url: string) => {
      if (url === "/api/v1/auth/refresh") {
        return Promise.resolve(new Response(null, { status: 401 }));
      }
      return Promise.resolve(jsonResponse({ status: "fail", message: "No autenticado." }, 401));
    });
    vi.stubGlobal("fetch", fetchSpy);

    const originalLocation = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...originalLocation, href: "" } });

    try {
      // The request never resolves once the session is genuinely over — the
      // browser is navigating away, so nothing downstream should act on it.
      void apiFetch("/orders");
      await vi.waitFor(() => expect(window.location.href).toBe(LOGIN_PATH));
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    }
  });

  it("resolves the original 401 instead of navigating when unauthorizedRedirectPath is null and the refresh fails", async () => {
    const fetchSpy = vi.fn((url: string) => {
      if (url === "/api/v1/auth/refresh") {
        return Promise.resolve(new Response(null, { status: 401 }));
      }
      return Promise.resolve(jsonResponse({ status: "fail", message: "No autenticado." }, 401));
    });
    vi.stubGlobal("fetch", fetchSpy);

    const originalLocation = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...originalLocation, href: "" } });

    try {
      await expect(apiFetch("/account", undefined, { unauthorizedRedirectPath: null })).rejects.toMatchObject({
        name: "ApiError",
        httpStatus: 401,
      });
      expect(window.location.href).toBe("");
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    }
  });

  it("shares a single refresh across concurrent 401s", async () => {
    let refreshCalls = 0;
    let nonRefreshCalls = 0;
    const fetchSpy = vi.fn((url: string) => {
      if (url === "/api/v1/auth/refresh") {
        refreshCalls += 1;
        return Promise.resolve(new Response(null, { status: 200 }));
      }
      nonRefreshCalls += 1;
      // The two original requests (calls 1-2) 401; both retries (after the
      // single shared refresh) succeed.
      if (nonRefreshCalls <= 2) {
        return Promise.resolve(jsonResponse({ status: "fail", message: "No autenticado." }, 401));
      }
      return Promise.resolve(jsonResponse({ status: "success", message: "OK", data: null }));
    });
    vi.stubGlobal("fetch", fetchSpy);

    await Promise.all([apiFetch("/orders"), apiFetch("/inventory")]);

    expect(refreshCalls).toBe(1);
  });
});
