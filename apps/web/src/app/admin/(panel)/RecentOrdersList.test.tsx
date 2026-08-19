import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecentOrdersList } from "./RecentOrdersList";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function sampleOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "1",
    orderNumber: "BW-2026-0192",
    status: "paid",
    priority: "normal",
    lines: [{ itemType: "bike", itemId: "1", sku: "BW-TR-M", name: "BW Test Ride", brand: "Black and White" }],
    totals: { subtotalCents: 150_000_00, taxCents: 0, shippingCents: 0, totalCents: 150_000_00, currency: "MXN" },
    createdAt: "2026-08-18T12:00:00.000Z",
    updatedAt: "2026-08-18T12:00:00.000Z",
    ...overrides,
  };
}

function stubFetch(orders: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/admin/orders")) {
        return Promise.resolve(jsonResponse({ status: "success", message: "OK", data: { orders } }));
      }
      return Promise.resolve(jsonResponse({ status: "success", message: "OK", data: {} }));
    }),
  );
}

describe("RecentOrdersList", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("requests the 5 most recent orders", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { orders: [] } }));
    vi.stubGlobal("fetch", fetchSpy);

    render(<RecentOrdersList />);

    await screen.findByText("Sin órdenes todavía.");
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/v1/admin/orders?limit=5");
  });

  it("renders each order's first line name, order number, total and status", async () => {
    stubFetch([sampleOrder()]);
    render(<RecentOrdersList />);

    expect(await screen.findByText("BW Test Ride")).toBeInTheDocument();
    expect(screen.getByText("$150,000.00")).toBeInTheDocument();
    expect(screen.getByText(/BW-2026-0192/)).toBeInTheDocument();
    expect(screen.getByText("pagada")).toBeInTheDocument();
  });

  it("shows a +N más suffix when an order has more than one line", async () => {
    stubFetch([
      sampleOrder({
        lines: [
          { itemType: "bike", itemId: "1", sku: "BW-TR-M", name: "BW Test Ride", brand: "Black and White" },
          { itemType: "accessory", itemId: "2", sku: "CA-1", name: "Casco Aether", brand: "Black and White" },
        ],
      }),
    ]);
    render(<RecentOrdersList />);

    expect(await screen.findByText(/\+1 más/)).toBeInTheDocument();
  });

  it("shows an empty state, not an error, when there are no orders yet", async () => {
    stubFetch([]);
    render(<RecentOrdersList />);

    expect(await screen.findByText("Sin órdenes todavía.")).toBeInTheDocument();
  });

  it("shows an error message when the fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    render(<RecentOrdersList />);

    expect(await screen.findByText("No se pudo cargar la lista.")).toBeInTheDocument();
  });
});
