import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAdminAuditLogs } from "./admin-audit-logs";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("listAdminAuditLogs", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("sends only whitelisted, non-empty params", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ status: "success", message: "OK", data: { logs: [] }, meta: { total: 0, page: 1, pages: 1, limit: 20 } }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    await listAdminAuditLogs({ module: "inventory", action: "inventory.stock_adjusted" });

    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "/api/v1/admin/audit-logs?module=inventory&action=inventory.stock_adjusted",
    );
  });

  it("sends no querystring when every param is omitted", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ status: "success", message: "OK", data: { logs: [] }, meta: { total: 0, page: 1, pages: 1, limit: 20 } }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    await listAdminAuditLogs({});

    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/v1/admin/audit-logs");
  });

  it("propagates a fail envelope as an ApiError with httpStatus — a plain admin gets 403 here", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ status: "fail", message: "No tienes permiso para realizar esta acción." }, 403)),
    );

    await expect(listAdminAuditLogs({})).rejects.toMatchObject({ httpStatus: 403 });
  });

  it("resolves with logs and meta", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          status: "success",
          message: "Bitácora obtenida.",
          data: { logs: [{ id: "1", action: "settings.pricing_updated" }] },
          meta: { total: 1, page: 1, pages: 1, limit: 20 },
        }),
      ),
    );

    const result = await listAdminAuditLogs({});
    expect(result.data.logs).toHaveLength(1);
    expect(result.meta?.total).toBe(1);
  });
});
