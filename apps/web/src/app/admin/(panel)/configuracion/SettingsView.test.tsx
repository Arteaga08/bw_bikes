import type { AdminSettings } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { SettingsView } from "./SettingsView";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const SETTINGS: AdminSettings = {
  inventory: { stockReservationTtlMinutes: 30, reservationRetentionDays: 30, lowStockThresholdUnits: 5 },
  orders: {
    orderPaymentTtlMinutes: 15,
    orderAuthAlertHours: 120,
    orderAuthCancelHours: 156,
    paymentReconciliationAfterMinutes: 20,
    requestThreeDSecure: "automatic",
  },
  pricing: { taxRateBps: 1600 },
  shipping: { accessoryFlatCents: 25_000, freeShippingThresholdCents: 200_000 },
  applications: { cooldownDays: 90 },
  jobs: {
    reservationReaperIntervalMs: 60_000,
    orderAuthSweepIntervalMs: 300_000,
    paymentReconciliationIntervalMs: 600_000,
    lowStockAlertIntervalMs: 300_000,
  },
  updatedAt: new Date().toISOString(),
};

function renderView() {
  return render(
    <ToastProvider>
      <SettingsView initial={SETTINGS} />
    </ToastProvider>,
  );
}

describe("SettingsView", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("renders all six sections", () => {
    renderView();
    expect(screen.getByText("Inventario")).toBeInTheDocument();
    expect(screen.getByText("Órdenes")).toBeInTheDocument();
    expect(screen.getByText("Precios")).toBeInTheDocument();
    expect(screen.getByText("Envíos")).toBeInTheDocument();
    expect(screen.getByText("Solicitudes")).toBeInTheDocument();
    expect(screen.getByText("Tareas programadas")).toBeInTheDocument();
  });

  it("saves the inventory section end to end: PUT real → toast → local state updated", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({
        status: "success",
        message: "Configuración de inventario actualizada.",
        data: { settings: { ...SETTINGS, inventory: { ...SETTINGS.inventory, lowStockThresholdUnits: 8 } } },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();

    renderView();

    const thresholdInput = screen.getByLabelText("Umbral de stock bajo (unidades)");
    await user.clear(thresholdInput);
    await user.type(thresholdInput, "8");

    const [inventoryForm] = screen.getAllByRole("button", { name: "Guardar" });
    await user.click(inventoryForm!);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/v1/admin/settings/inventory",
      expect.objectContaining({ method: "PUT" }),
    );
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      stockReservationTtlMinutes: 30,
      reservationRetentionDays: 30,
      lowStockThresholdUnits: 8,
    });

    expect(await screen.findByText("Inventario actualizado")).toBeInTheDocument();
  });

  it("blocks the orders save client-side when alert hours isn't below cancel hours", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();

    renderView();

    const alertInput = screen.getByLabelText("Horas de aviso");
    await user.clear(alertInput);
    await user.type(alertInput, "200");

    const [, ordersSave] = screen.getAllByRole("button", { name: "Guardar" });
    await user.click(ordersSave!);

    expect(await screen.findByText("Las horas de aviso deben ser menores a las de cancelación.")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
