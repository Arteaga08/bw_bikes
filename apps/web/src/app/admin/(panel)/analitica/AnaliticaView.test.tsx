import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnaliticaView } from "./AnaliticaView";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function overviewResponse() {
  return jsonResponse({
    status: "success",
    message: "Resumen de estadísticas obtenido.",
    data: {
      overview: {
        range: { preset: "30d", from: "2026-07-18", to: "2026-08-17" },
        orders: {
          range: { preset: "30d", from: "2026-07-18", to: "2026-08-17" },
          countsByStatus: { pending_payment: 1, authorized: 0, awaiting_supplier_confirmation: 0, authorization_expired: 0, paid: 4, processing: 0, shipped: 0, delivered: 2, cancelled: 0, refunded: 0 },
          revenueCents: 100_000_00,
          averageOrderValueCents: 20_000_00,
          ordersByDay: [],
        },
        inventory: { range: {}, unitsCommitted: 12, outOfStockSkus: 2, lowStockSkus: 3 },
        applications: { range: {}, submitted: 5, approved: 3, rejected: 1 },
        preferences: {
          range: {},
          mostViewedModels: [{ itemType: "bike", itemId: "1", name: "Tarmac SL7", brand: "Specialized", count: 40 }],
          mostViewedSizes: [],
          mostSoldModels: [],
          mostSoldSizes: [],
        },
        alerts: { awaitingSupplierConfirmation: 0, expiringAuthorizations: 0, staleUnpaidOrders: 0, pendingApplications: 0, outOfStockSkus: 2 },
      },
    },
  });
}

describe("AnaliticaView", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("resolves the window once via /admin/stats/overview and renders the inventory KPIs", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(overviewResponse());
    vi.stubGlobal("fetch", fetchSpy);

    render(<AnaliticaView />);

    expect(await screen.findByText("SKUs agotados")).toBeInTheDocument();
    expect(screen.getByText("2", { selector: "span.font-display" })).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/v1/admin/stats/overview?preset=30d");
  });

  it("renders the órdenes por estatus table with every known status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(overviewResponse()));
    render(<AnaliticaView />);

    expect(await screen.findByText("Órdenes por estatus")).toBeInTheDocument();
    expect(screen.getByText("pagada")).toBeInTheDocument();
    expect(screen.getByText("cancelada")).toBeInTheDocument();
  });
});
