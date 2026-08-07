import { beforeEach, describe, expect, it, vi } from "vitest";
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
});
