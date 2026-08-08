import type { AdminOrder } from "@bw-bikes/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { OrdersView } from "./OrdersView";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function makeOrder(overrides: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: "order-1",
    orderNumber: "BW-2026-K7XQ2M",
    status: "awaiting_supplier_confirmation",
    lines: [],
    totals: { subtotalCents: 25_000_00, taxCents: 3_448_28, shippingCents: 0, totalCents: 25_000_00, currency: "MXN" },
    payment: {
      provider: "stripe",
      state: "authorized",
      captureMethod: "manual",
      authorizedAt: new Date().toISOString(),
    },
    shippingAddress: {
      recipientName: "Ana Pérez",
      phone: "5512345678",
      street: "Av. Reforma 100",
      neighborhood: "Juárez",
      city: "Ciudad de México",
      state: "Ciudad de México",
      postalCode: "06600",
      country: "MX",
    },
    statusHistory: [],
    customer: { id: "u1", email: "ana@example.com", firstName: "Ana", lastName: "Pérez" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderView() {
  return render(
    <ToastProvider>
      <OrdersView orderAuthAlertHours={120} orderAuthCancelHours={156} />
    </ToastProvider>,
  );
}

describe("OrdersView", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the empty state when the queue has no orders", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ status: "success", message: "Órdenes obtenidas.", data: { orders: [] }, meta: { total: 0, page: 1, pages: 1, limit: 20 } }),
      ),
    );

    renderView();

    expect(await screen.findByText("No hay órdenes esperando confirmación")).toBeInTheDocument();
  });

  it("renders a fetched order in the queue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          status: "success",
          message: "Órdenes obtenidas.",
          data: { orders: [makeOrder()] },
          meta: { total: 1, page: 1, pages: 1, limit: 20 },
        }),
      ),
    );

    renderView();

    expect(await screen.findByText("BW-2026-K7XQ2M")).toBeInTheDocument();
  });

  it("confirming an order calls the endpoint, toasts success, and refetches the list", async () => {
    const order = makeOrder();
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/confirm-supplier-stock")) {
        return Promise.resolve(
          jsonResponse({
            status: "success",
            message: "Stock confirmado y pago capturado.",
            data: { order: { ...order, status: "paid" } },
          }),
        );
      }
      // Every GET /admin/orders call — including the post-confirm refetch.
      return Promise.resolve(
        jsonResponse({
          status: "success",
          message: "Órdenes obtenidas.",
          data: { orders: [order] },
          meta: { total: 1, page: 1, pages: 1, limit: 20 },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchSpy);

    const user = userEvent.setup();
    renderView();

    await screen.findByText("BW-2026-K7XQ2M");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    await user.click(screen.getByRole("button", { name: "Confirmar y capturar el cargo" }));

    await waitFor(() => {
      expect(screen.getByText("BW-2026-K7XQ2M confirmada")).toBeInTheDocument();
    });

    const confirmCalls = fetchSpy.mock.calls.filter((call: unknown[]) =>
      (call[0] as string).endsWith("/confirm-supplier-stock"),
    );
    expect(confirmCalls).toHaveLength(1);
    expect(confirmCalls[0]?.[1]).toMatchObject({ method: "POST" });

    // At least the initial GET plus the post-confirm refetch.
    const listCalls = fetchSpy.mock.calls.filter((call: unknown[]) => (call[0] as string).includes("/admin/orders?"));
    expect(listCalls.length).toBeGreaterThanOrEqual(2);
  });
});
