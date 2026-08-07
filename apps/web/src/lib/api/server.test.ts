import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock } = vi.hoisted(() => ({ cookiesMock: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));

const { serverApiFetch } = await import("./server");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("serverApiFetch", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "http://api.internal.test");
    cookiesMock.mockResolvedValue({ toString: () => "bw_access=abc123" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { ok: true } })));
  });

  it("calls the real API URL with cache: no-store and forwards the incoming cookies", async () => {
    await serverApiFetch("/auth/me");

    expect(fetch).toHaveBeenCalledWith(
      "http://api.internal.test/api/v1/auth/me",
      expect.objectContaining({
        cache: "no-store",
        headers: expect.objectContaining({ cookie: "bw_access=abc123" }),
      }),
    );
  });

  it("omits the cookie header entirely when there are no cookies to forward", async () => {
    cookiesMock.mockResolvedValue({ toString: () => "" });

    await serverApiFetch("/auth/me");

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init?.headers).not.toHaveProperty("cookie");
  });

  it("throws ApiError with the generic network message when fetch itself rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    await expect(serverApiFetch("/auth/me")).rejects.toMatchObject({
      name: "ApiError",
      httpStatus: 0,
    });
  });

  it("throws ApiError with the backend's message on a fail/error envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ status: "fail", message: "Sesión inválida o expirada." }, 401)),
    );

    await expect(serverApiFetch("/auth/me")).rejects.toMatchObject({
      name: "ApiError",
      message: "Sesión inválida o expirada.",
      httpStatus: 401,
    });
  });
});
