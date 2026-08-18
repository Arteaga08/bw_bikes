import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminSettings, updateAdminSettingsSection } from "./admin-settings";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("getAdminSettings", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("GETs /admin/settings and unwraps the document", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({ status: "success", message: "Configuración obtenida.", data: { settings: { inventory: { lowStockThresholdUnits: 5 } } } }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const settings = await getAdminSettings();

    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/v1/admin/settings");
    expect(settings).toMatchObject({ inventory: { lowStockThresholdUnits: 5 } });
  });
});

describe("updateAdminSettingsSection", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("PUTs to the section-specific path with the section's own body", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({
        status: "success",
        message: "Configuración de inventario actualizada.",
        data: { settings: { inventory: { stockReservationTtlMinutes: 45, reservationRetentionDays: 30, lowStockThresholdUnits: 8 } } },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await updateAdminSettingsSection("inventory", {
      stockReservationTtlMinutes: 45,
      reservationRetentionDays: 30,
      lowStockThresholdUnits: 8,
    });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/admin/settings/inventory");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({
      stockReservationTtlMinutes: 45,
      reservationRetentionDays: 30,
      lowStockThresholdUnits: 8,
    });
  });

  it("propagates a fail envelope as an ApiError with httpStatus", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ status: "fail", message: "El umbral de stock bajo es obligatorio." }, 400)),
    );

    await expect(
      updateAdminSettingsSection("inventory", {
        stockReservationTtlMinutes: 30,
        reservationRetentionDays: 30,
      } as never),
    ).rejects.toMatchObject({ httpStatus: 400 });
  });
});
