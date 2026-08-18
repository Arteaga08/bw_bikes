import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOperationalAlerts, getOrdersStats, getStatsOverview } from "./admin-stats";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("getOrdersStats", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("sends only whitelisted, non-empty range params", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { stats: { countsByStatus: {} } } }));
    vi.stubGlobal("fetch", fetchSpy);

    await getOrdersStats({ preset: "7d" });

    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/v1/admin/stats/orders?preset=7d");
  });

  it("sends no querystring when every param is omitted", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { stats: { countsByStatus: {} } } }));
    vi.stubGlobal("fetch", fetchSpy);

    await getOrdersStats({});

    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/v1/admin/stats/orders");
  });

  it("propagates a fail envelope as an ApiError with httpStatus", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ status: "fail", message: '"from" y "to" son obligatorios para un rango personalizado.' }, 400)),
    );

    await expect(getOrdersStats({ preset: "custom" })).rejects.toMatchObject({ httpStatus: 400 });
  });
});

describe("getOperationalAlerts", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("never sends a querystring — the endpoint takes no range params", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({
        status: "success",
        message: "Alertas operativas obtenidas.",
        data: { alerts: { awaitingSupplierConfirmation: 2, expiringAuthorizations: 0, staleUnpaidOrders: 0, pendingApplications: 1, outOfStockSkus: 0 } },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const alerts = await getOperationalAlerts();

    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/v1/admin/stats/alerts");
    expect(alerts.awaitingSupplierConfirmation).toBe(2);
  });
});

describe("getStatsOverview", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("GETs /admin/stats/overview with the range and unwraps the composed payload", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({ status: "success", message: "OK", data: { overview: { range: { preset: "30d" } } } }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const overview = await getStatsOverview({ preset: "30d" });

    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/v1/admin/stats/overview?preset=30d");
    expect(overview.range.preset).toBe("30d");
  });
});
