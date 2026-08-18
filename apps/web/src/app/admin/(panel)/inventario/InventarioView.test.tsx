import type { AdminInventoryItem } from "@bw-bikes/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { InventarioView } from "./InventarioView";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function makeItem(overrides: Partial<AdminInventoryItem> = {}): AdminInventoryItem {
  return {
    id: "item-1",
    itemType: "bike",
    itemId: "bike-1",
    sku: "BK-TARMAC-M",
    onHand: 2,
    reserved: 0,
    available: 2,
    product: { name: "Tarmac SL7", brand: "Specialized" },
    variant: { size: "M", fulfillmentMode: "in_stock" },
    lowStockThresholdUnits: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function emptyList(): Response {
  return jsonResponse({ status: "success", message: "OK", data: { items: [] }, meta: { total: 0, page: 1, pages: 1, limit: 50 } });
}

function stubFetch(overrides: { outItems?: AdminInventoryItem[]; lowItems?: AdminInventoryItem[] } = {}) {
  const fetchSpy = vi.fn().mockImplementation((url: string) => {
    if (url.includes("/admin/inventory/summary")) {
      return Promise.resolve(jsonResponse({ status: "success", message: "OK", data: { summary: { groups: [] } } }));
    }
    if (url.includes("stock=out")) {
      return Promise.resolve(
        overrides.outItems
          ? jsonResponse({ status: "success", message: "OK", data: { items: overrides.outItems }, meta: { total: overrides.outItems.length, page: 1, pages: 1, limit: 50 } })
          : emptyList(),
      );
    }
    if (url.includes("stock=low")) {
      return Promise.resolve(
        overrides.lowItems
          ? jsonResponse({ status: "success", message: "OK", data: { items: overrides.lowItems }, meta: { total: overrides.lowItems.length, page: 1, pages: 1, limit: 50 } })
          : emptyList(),
      );
    }
    if (url.includes("/admin/bikes")) {
      return Promise.resolve(jsonResponse({ status: "success", message: "OK", data: { bikes: [] } }));
    }
    if (url.includes("/admin/accessories")) {
      return Promise.resolve(jsonResponse({ status: "success", message: "OK", data: { accessories: [] } }));
    }
    if (url.match(/\/admin\/inventory\/item-1\/stock/)) {
      return Promise.resolve(
        jsonResponse({
          status: "success",
          message: "Stock actualizado.",
          data: { item: { ...makeItem(overrides.outItems?.[0] ?? overrides.lowItems?.[0] ?? {}), onHand: 7, available: 7 } },
        }),
      );
    }
    return Promise.resolve(emptyList());
  });
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

function renderView() {
  return render(
    <ToastProvider>
      <InventarioView />
    </ToastProvider>,
  );
}

describe("InventarioView", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("shows the healthy empty state when nothing needs reordering", async () => {
    stubFetch();
    renderView();

    expect(await screen.findByText("Todos los SKUs están por encima de su umbral")).toBeInTheDocument();
  });

  it("renders a low-stock row with available prominent and en bodega/apartado subordinate", async () => {
    stubFetch({ lowItems: [makeItem({ available: 3, onHand: 3, reserved: 0 })] });
    renderView();

    expect(await screen.findByText("Tarmac SL7")).toBeInTheDocument();
    expect(screen.getByText("3", { selector: "span.font-display" })).toBeInTheDocument();
    expect(screen.getByText("3 en bodega")).toBeInTheDocument();
    expect(screen.getByText("Bajo")).toBeInTheDocument();
  });

  it("shows 'apartado' only when reserved > 0", async () => {
    stubFetch({ lowItems: [makeItem({ available: 3, onHand: 5, reserved: 2 })] });
    renderView();

    expect(await screen.findByText("5 en bodega · 2 apartado")).toBeInTheDocument();
  });

  it("marks an on_request variant as 'Bajo pedido', never 'Agotado'", async () => {
    stubFetch({
      outItems: [makeItem({ available: 0, onHand: 0, variant: { fulfillmentMode: "on_request" } })],
    });
    renderView();

    expect(await screen.findByText("Bajo pedido")).toBeInTheDocument();
    expect(screen.queryByText("Agotado")).not.toBeInTheDocument();
  });

  it("adjusts stock end to end: PATCH real → toast → refetch", async () => {
    const fetchSpy = stubFetch({ lowItems: [makeItem({ available: 3, onHand: 3 })] });
    const user = userEvent.setup();
    renderView();

    await user.click(await screen.findByRole("button", { name: "Ajustar" }));
    await user.type(screen.getByLabelText("Unidades"), "5");
    await user.type(screen.getByLabelText("Motivo"), "Recepción de embarque");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/v1/admin/inventory/item-1/stock",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
    const call = fetchSpy.mock.calls.find((args: unknown[]) => args[0] === "/api/v1/admin/inventory/item-1/stock");
    expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({ delta: 5, reason: "Recepción de embarque" });
    expect(await screen.findByText("Stock actualizado")).toBeInTheDocument();
  });
});
