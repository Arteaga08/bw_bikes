import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeStats } from "./HomeStats";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const ORDERS_BY_DAY = [
  { date: "2026-08-14", count: 1, revenueCents: 80_000_00 },
  { date: "2026-08-15", count: 2, revenueCents: 150_000_00 },
  { date: "2026-08-16", count: 0, revenueCents: 0 },
  { date: "2026-08-17", count: 1, revenueCents: 270_000_00 },
];

// `orderCount: 2` (not 4) deliberately doesn't produce the same +25% delta
// as revenue's 500_000_00-vs-400_000_00 — a coincidental collision made an
// earlier version of this fixture assert against two different KPI tiles
// without realizing it.
const DEFAULT_PREVIOUS = { revenueCents: 400_000_00, orderCount: 2, averageOrderValueCents: 100_000_00 };

function ordersStatsBody(overrides: { previous?: unknown } = {}) {
  // `"previous" in overrides` rather than `overrides.previous ?? DEFAULT` —
  // the latter would collapse an explicit `previous: null` (the case this
  // fixture exists to produce) back to the default, since `??` treats
  // `null` the same as "not provided".
  const previous = "previous" in overrides ? overrides.previous : DEFAULT_PREVIOUS;
  return {
    status: "success",
    message: "OK",
    data: {
      stats: {
        range: { preset: "30d", from: "2026-07-18", to: "2026-08-17" },
        countsByStatus: {
          pending_payment: 1,
          authorized: 0,
          paid: 1,
          processing: 0,
          shipped: 1,
          delivered: 2,
          cancelled: 0,
          refunded: 0,
          awaiting_supplier_confirmation: 0,
          authorization_expired: 0,
        },
        revenueCents: 500_000_00,
        averageOrderValueCents: 100_000_00,
        ordersByDay: ORDERS_BY_DAY,
        previous,
      },
    },
  };
}

function preferencesStatsBody() {
  return {
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
  };
}

function recentOrdersBody() {
  return {
    status: "success",
    message: "OK",
    data: { orders: [] },
  };
}

function stubFetch(options: { ordersOverrides?: { previous?: unknown }; failOrders?: boolean } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/admin/stats/orders")) {
        if (options.failOrders) return Promise.reject(new Error("network error"));
        return Promise.resolve(jsonResponse(ordersStatsBody(options.ordersOverrides)));
      }
      if (url.includes("/admin/stats/preferences")) {
        return Promise.resolve(jsonResponse(preferencesStatsBody()));
      }
      if (url.includes("/admin/orders")) {
        return Promise.resolve(jsonResponse(recentOrdersBody()));
      }
      return Promise.resolve(jsonResponse({ status: "success", message: "OK", data: {} }));
    }),
  );
}

describe("HomeStats", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("renders revenue, order count, ticket promedio and órdenes completadas once loaded", async () => {
    stubFetch();
    render(<HomeStats />);

    expect(await screen.findByText("$500,000.00")).toBeInTheDocument();
    expect(screen.getByText("Ingresos")).toBeInTheDocument();
    expect(screen.getByText("Órdenes")).toBeInTheDocument();
    expect(screen.getByText("Ticket promedio")).toBeInTheDocument();

    // shipped(1) + delivered(2) = 3 of 5 total → 60%.
    expect(screen.getByText("Órdenes completadas")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("3 de 5 órdenes")).toBeInTheDocument();
  });

  it("renders a signed percentage delta against the previous window", async () => {
    stubFetch();
    render(<HomeStats />);

    await screen.findByText("$500,000.00");
    // (500_000_00 - 400_000_00) / 400_000_00 = +25%.
    expect(screen.getByText("+25% vs. periodo anterior")).toBeInTheDocument();
    // Órdenes: 5 (totalOrders) vs. previous.orderCount 2 = +150%.
    expect(screen.getByText("+150% vs. periodo anterior")).toBeInTheDocument();
    // Ticket promedio: unchanged (100_000_00 both sides).
    expect(screen.getByText("Sin cambio vs. periodo anterior")).toBeInTheDocument();
  });

  it("says there is no baseline instead of showing a delta when the previous window has no orders", async () => {
    stubFetch({ ordersOverrides: { previous: null } });
    render(<HomeStats />);

    await screen.findByText("$500,000.00");
    expect(screen.getAllByText("Sin base de comparación").length).toBeGreaterThan(0);
  });

  it("titles the time-series chart Ingresos por día, not Órdenes por día", async () => {
    stubFetch();
    render(<HomeStats />);

    expect(await screen.findByText("Ingresos por día")).toBeInTheDocument();
    expect(screen.queryByText("Órdenes por día")).not.toBeInTheDocument();
  });

  it("renders the ranked-models chart card once preferences load", async () => {
    stubFetch();
    render(<HomeStats />);

    expect(await screen.findByText("Modelos más vendidos")).toBeInTheDocument();
    expect(screen.queryByText("Sin datos en este periodo.")).not.toBeInTheDocument();
  });

  it("shows an error message instead of hanging on stale skeletons when the fetch fails", async () => {
    stubFetch({ failOrders: true });
    render(<HomeStats />);

    expect(await screen.findByText("No se pudo cargar el resumen. Intenta de nuevo.")).toBeInTheDocument();
  });
});
