import type { AdminInventoryItem, InventorySummaryGroup, InventorySummaryTotals } from "@bw-bikes/shared";
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

function makeGroup(overrides: Partial<InventorySummaryGroup> = {}): InventorySummaryGroup {
  return {
    itemType: "bike",
    categoryId: "cat-1",
    categoryName: "Ruta",
    totalSkus: 1,
    outOfStockSkus: 0,
    lowStockSkus: 0,
    ...overrides,
  };
}

function makeTotals(overrides: Partial<InventorySummaryTotals> = {}): InventorySummaryTotals {
  return { totalSkus: 0, outOfStockSkus: 0, lowStockSkus: 0, newSkus: 0, ...overrides };
}

function emptyList(): Response {
  return jsonResponse({ status: "success", message: "OK", data: { items: [] }, meta: { total: 0, page: 1, pages: 1, limit: 50 } });
}

function stubFetch(
  overrides: {
    groups?: InventorySummaryGroup[];
    totals?: InventorySummaryTotals;
    categoryItems?: AdminInventoryItem[];
    searchItems?: AdminInventoryItem[];
  } = {},
) {
  const groups = overrides.groups ?? [];
  const totals = overrides.totals ?? makeTotals();

  const fetchSpy = vi.fn().mockImplementation((url: string) => {
    if (url.includes("/admin/inventory/summary")) {
      return Promise.resolve(jsonResponse({ status: "success", message: "OK", data: { summary: { groups, totals } } }));
    }
    if (url.includes("/admin/inventory") && url.includes("search=")) {
      return Promise.resolve(
        overrides.searchItems
          ? jsonResponse({
              status: "success",
              message: "OK",
              data: { items: overrides.searchItems },
              meta: { total: overrides.searchItems.length, page: 1, pages: 1, limit: 50 },
            })
          : emptyList(),
      );
    }
    if (url.includes("/admin/inventory") && url.includes("category=")) {
      return Promise.resolve(
        overrides.categoryItems
          ? jsonResponse({
              status: "success",
              message: "OK",
              data: { items: overrides.categoryItems },
              meta: { total: overrides.categoryItems.length, page: 1, pages: 1, limit: 100 },
            })
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
          data: { item: { ...makeItem(overrides.categoryItems?.[0] ?? {}), onHand: 7, available: 7 } },
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

  it("shows neutral alert cards and a collapsed healthy band when nothing needs attention", async () => {
    stubFetch({ groups: [makeGroup()], totals: makeTotals() });
    renderView();

    expect(await screen.findByText("Ninguno agotado")).toBeInTheDocument();
    expect(screen.getByText("Ninguno bajo su umbral")).toBeInTheDocument();
    expect(screen.getByText("Ruta")).toBeInTheDocument();
    // A healthy band starts collapsed, so its row content never fetched/rendered.
    expect(screen.queryByText("Tarmac SL7")).not.toBeInTheDocument();
  });

  it("renders a low-stock row with available prominent and en bodega/apartado subordinate", async () => {
    stubFetch({
      groups: [makeGroup({ lowStockSkus: 1 })],
      totals: makeTotals({ lowStockSkus: 1 }),
      categoryItems: [makeItem({ available: 3, onHand: 3, reserved: 0 })],
    });
    renderView();

    expect(await screen.findByText("Tarmac SL7")).toBeInTheDocument();
    expect(screen.getByText("3", { selector: "span.font-display" })).toBeInTheDocument();
    expect(screen.getByText("3 en bodega")).toBeInTheDocument();
    expect(screen.getByText("Bajo")).toBeInTheDocument();
  });

  it("shows 'apartado' only when reserved > 0", async () => {
    stubFetch({
      groups: [makeGroup({ lowStockSkus: 1 })],
      totals: makeTotals({ lowStockSkus: 1 }),
      categoryItems: [makeItem({ available: 3, onHand: 5, reserved: 2 })],
    });
    renderView();

    expect(await screen.findByText("5 en bodega · 2 apartado")).toBeInTheDocument();
  });

  it("marks an on_request variant as 'Bajo pedido', never 'Agotado'", async () => {
    stubFetch({
      groups: [makeGroup({ outOfStockSkus: 1 })],
      totals: makeTotals({ outOfStockSkus: 1 }),
      categoryItems: [makeItem({ available: 0, onHand: 0, variant: { fulfillmentMode: "on_request" } })],
    });
    renderView();

    expect(await screen.findByText("Bajo pedido")).toBeInTheDocument();
    expect(screen.queryByText("Agotado")).not.toBeInTheDocument();
  });

  it("adjusts stock end to end: PATCH real → toast → refetch", async () => {
    const fetchSpy = stubFetch({
      groups: [makeGroup({ lowStockSkus: 1 })],
      totals: makeTotals({ lowStockSkus: 1 }),
      categoryItems: [makeItem({ available: 3, onHand: 3 })],
    });
    const user = userEvent.setup();
    renderView();

    await user.click(await screen.findByRole("button", { name: "Ajustar" }));
    // `StockAdjustDialog` is code-split (`next/dynamic`, Sesión 2 de la
    // auditoría de rendimiento) — it mounts asynchronously after the click
    // that first reveals it, so its first field needs `findBy`, not `getBy`.
    await user.type(await screen.findByLabelText("Unidades"), "5");
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

  it("shows a placeholder icon instead of an empty box when the product has no photo", async () => {
    const { container } = (() => {
      stubFetch({
        groups: [makeGroup({ lowStockSkus: 1 })],
        totals: makeTotals({ lowStockSkus: 1 }),
        categoryItems: [makeItem()], // no product.imageUrl
      });
      return renderView();
    })();

    expect(await screen.findByText("Tarmac SL7")).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("clicking the 'Bajos' card forces every band open and filters its rows to stock=low", async () => {
    const fetchSpy = stubFetch({
      groups: [makeGroup({ categoryName: "Ruta", lowStockSkus: 0, outOfStockSkus: 0 })],
      totals: makeTotals({ lowStockSkus: 1 }),
      categoryItems: [makeItem({ available: 3, onHand: 3 })],
    });
    const user = userEvent.setup();
    renderView();

    // Healthy band starts collapsed — its row is not fetched yet.
    expect(await screen.findByText("Ruta")).toBeInTheDocument();
    expect(screen.queryByText("Tarmac SL7")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Bajos/ }));

    expect(await screen.findByText("Tarmac SL7")).toBeInTheDocument();
    expect(await screen.findByText("Filtro: Bajos")).toBeInTheDocument();

    const bandCall = fetchSpy.mock.calls.find(
      (args: unknown[]) => typeof args[0] === "string" && (args[0] as string).includes("category="),
    );
    expect(bandCall![0]).toContain("stock=low");
  });

  it("typing in the search box replaces the category bands with a flat SKU-matched list", async () => {
    stubFetch({
      groups: [makeGroup()],
      totals: makeTotals(),
      searchItems: [makeItem({ sku: "BK-TARMAC-M" })],
    });
    const user = userEvent.setup();
    renderView();

    await screen.findByText("Ruta");
    await user.type(screen.getByPlaceholderText("Buscar por SKU"), "TARMAC");

    expect(await screen.findByText("Tarmac SL7")).toBeInTheDocument();
    // The category band structure (with its own SKU count/eyebrow) is replaced while searching.
    expect(screen.queryByText("1 SKUs")).not.toBeInTheDocument();
  });
});
