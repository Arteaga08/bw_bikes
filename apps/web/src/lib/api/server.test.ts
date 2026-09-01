import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, redirectMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

const { serverApiFetch } = await import("./server");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("serverApiFetch", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "http://api.internal.test");
    cookiesMock.mockResolvedValue({ toString: () => "bw_access=abc123" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { ok: true } })));
    redirectMock.mockClear();
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

  it("does not redirect on a 401 from /auth/* — requireAdminSession needs to catch and handle it itself", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: "fail", message: "No autenticado." }, 401)));

    await expect(serverApiFetch("/auth/me")).rejects.toMatchObject({ name: "ApiError", httpStatus: 401 });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects to login on a 401 outside /auth/* — the access token expired after the layout's own guard already passed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: "fail", message: "No autenticado." }, 401)));

    await expect(serverApiFetch("/admin/bikes/bike-1")).rejects.toThrow("REDIRECT:/admin/login");
    expect(redirectMock).toHaveBeenCalledWith("/admin/login");
  });

  it("does not redirect on a 401 outside /auth/* when unauthorizedRedirectPath is null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: "fail", message: "No autenticado." }, 401)));

    await expect(serverApiFetch("/account", undefined, { unauthorizedRedirectPath: null })).rejects.toMatchObject({
      name: "ApiError",
      httpStatus: 401,
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
