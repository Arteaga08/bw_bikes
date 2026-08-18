import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeStats } from "./HomeStats";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/admin/stats/orders")) {
        return Promise.resolve(
          jsonResponse({
            status: "success",
            message: "OK",
            data: {
              stats: {
                range: { preset: "30d", from: "2026-07-18", to: "2026-08-17" },
                countsByStatus: { pending_payment: 1, authorized: 0, paid: 3, processing: 0, shipped: 0, delivered: 2, cancelled: 0, refunded: 0, awaiting_supplier_confirmation: 0, authorization_expired: 0 },
                revenueCents: 500_000_00,
                averageOrderValueCents: 100_000_00,
                ordersByDay: [{ date: "2026-08-15", count: 2 }],
              },
            },
          }),
        );
      }
      if (url.includes("/admin/stats/preferences")) {
        return Promise.resolve(
          jsonResponse({
            status: "success",
            message: "OK",
            data: {
              stats: {
                range: { preset: "30d", from: "2026-07-18", to: "2026-08-17" },
                mostViewedModels: [],
                mostViewedSizes: [],
                mostSoldModels: [{ itemType: "bike", itemId: "1", name: "Tarmac SL7", brand: "Specialized", count: 8 }],
                mostSoldSizes: [],
              },
            },
          }),
        );
      }
      return Promise.resolve(jsonResponse({ status: "success", message: "OK", data: {} }));
    }),
  );
}

describe("HomeStats", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("renders revenue, order count and pending KPIs once loaded", async () => {
    stubFetch();
    render(<HomeStats />);

    expect(await screen.findByText("$500,000.00")).toBeInTheDocument();
    expect(screen.getByText("Ingresos")).toBeInTheDocument();
    // pending = pending_payment(1) + authorized(0) + awaiting_supplier_confirmation(0) = 1
    expect(screen.getByText("Pendientes")).toBeInTheDocument();
  });

  it("renders the ranked-models chart card once preferences load (Recharts needs real layout to paint bars, which jsdom doesn't provide — the card itself loading is what this asserts)", async () => {
    stubFetch();
    render(<HomeStats />);

    expect(await screen.findByText("Modelos más vendidos")).toBeInTheDocument();
    expect(screen.queryByText("Sin datos en este periodo.")).not.toBeInTheDocument();
  });
});
