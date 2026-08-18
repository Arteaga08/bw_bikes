import { beforeEach, describe, expect, it, vi } from "vitest";
import { approveApplication, listAdminApplications, rejectApplication } from "./admin-applications";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("listAdminApplications", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("sends only whitelisted, non-empty params", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ status: "success", message: "OK", data: { applications: [] }, meta: { total: 0, page: 1, pages: 1, limit: 20 } }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    await listAdminApplications({ status: "pending", type: "ambassador" });

    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/v1/admin/applications?status=pending&type=ambassador");
  });

  it("never sends a search param, even if one were passed through", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ status: "success", message: "OK", data: { applications: [] }, meta: { total: 0, page: 1, pages: 1, limit: 20 } }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    await listAdminApplications({});

    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/v1/admin/applications");
  });

  it("propagates a fail envelope as an ApiError with httpStatus", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ status: "fail", message: "No tienes permiso para realizar esta acción." }, 403)),
    );

    await expect(listAdminApplications({})).rejects.toMatchObject({ httpStatus: 403 });
  });
});

describe("approveApplication / rejectApplication", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("POSTs to approve with no body", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({ status: "success", message: "Solicitud aprobada.", data: { application: { id: "1", status: "approved" } } }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const application = await approveApplication("1");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/v1/admin/applications/1/approve",
      expect.objectContaining({ method: "POST" }),
    );
    expect(application.status).toBe("approved");
  });

  it("POSTs the reason to reject", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({ status: "success", message: "Solicitud rechazada.", data: { application: { id: "1", status: "rejected" } } }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await rejectApplication("1", "No cumple los requisitos mínimos.");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ reason: "No cumple los requisitos mínimos." });
  });
});
