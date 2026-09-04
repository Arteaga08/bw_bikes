import type { AdminInventoryProductDetail, AdminInventoryProductRow, AdminInventoryVariantRow } from "@bw-bikes/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { ProductInventoryModal } from "./ProductInventoryModal";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function makeProductRow(overrides: Partial<AdminInventoryProductRow> = {}): AdminInventoryProductRow {
  return {
    itemType: "bike",
    itemId: "bike-1",
    name: "Tarmac SL7",
    brand: "Specialized",
    categoryName: "Ruta",
    variantCount: 1,
    untrackedVariantCount: 0,
    totalAvailable: 4,
    totalOnHand: 5,
    totalReserved: 1,
    outOfStockVariants: 0,
    lowStockVariants: 0,
    status: "ok",
    ...overrides,
  };
}

function makeVariant(overrides: Partial<AdminInventoryVariantRow> = {}): AdminInventoryVariantRow {
  return {
    inventoryItemId: "item-1",
    sku: "BK-M-RED",
    size: "M",
    color: "Rojo",
    fulfillmentMode: "in_stock",
    onHand: 5,
    reserved: 1,
    available: 4,
    lowStockThresholdUnits: 5,
    ...overrides,
  };
}

function makeDetail(variants: AdminInventoryVariantRow[]): AdminInventoryProductDetail {
  return {
    itemType: "bike",
    itemId: "bike-1",
    name: "Tarmac SL7",
    brand: "Specialized",
    categoryName: "Ruta",
    variants,
  };
}

function detailResponse(detail: AdminInventoryProductDetail): Response {
  return jsonResponse({ status: "success", message: "OK", data: { product: detail } });
}

function renderModal(props: { detail: AdminInventoryProductDetail; onMutated?: () => void; onClose?: () => void }) {
  const product = makeProductRow();
  return render(
    <ToastProvider>
      <ProductInventoryModal
        product={product}
        onClose={props.onClose ?? vi.fn()}
        onMutated={props.onMutated ?? vi.fn()}
        colorTemplatesByValue={new Map()}
      />
    </ToastProvider>,
  );
}

describe("ProductInventoryModal", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("groups variants by color, one group per color", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        detailResponse(
          makeDetail([
            makeVariant({ sku: "BK-M-RED", size: "M", color: "Rojo" }),
            makeVariant({ sku: "BK-L-RED", size: "L", color: "Rojo", inventoryItemId: "item-2" }),
            makeVariant({ sku: "BK-M-BLU", size: "M", color: "Azul", inventoryItemId: "item-3" }),
          ]),
        ),
      ),
    );
    renderModal({ detail: makeDetail([]) });

    expect(await screen.findByText("Rojo")).toBeInTheDocument();
    expect(screen.getByText("Azul")).toBeInTheDocument();
    expect(screen.getByText("2 tallas · 8 disponibles")).toBeInTheDocument();
  });

  it("'+' on a tracked variant PATCHes {delta} with no reason key and updates only that row", async () => {
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/stock")) {
        return Promise.resolve(
          jsonResponse({
            status: "success",
            message: "Stock actualizado.",
            data: { item: { id: "item-1", itemType: "bike", itemId: "bike-1", sku: "BK-M-RED", onHand: 6, reserved: 1, available: 5, lowStockThresholdUnits: 5, createdAt: "", updatedAt: "" } },
          }),
        );
      }
      return Promise.resolve(detailResponse(makeDetail([makeVariant()])));
    });
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    renderModal({ detail: makeDetail([]) });

    await screen.findByText("Rojo");
    await user.click(screen.getByRole("button", { name: "Sumar unidades" }));

    await waitFor(() => {
      const call = fetchSpy.mock.calls.find((args: unknown[]) => (args[0] as string).includes("/stock"));
      expect(call).toBeDefined();
    });
    const call = fetchSpy.mock.calls.find((args: unknown[]) => (args[0] as string).includes("/stock"))!;
    expect(call[0]).toBe("/api/v1/admin/inventory/item-1/stock");
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body).toEqual({ delta: 1 });
    expect(body).not.toHaveProperty("reason");

    expect(await screen.findByText("5", { selector: "span.font-display" })).toBeInTheDocument();
  });

  it("'-' sends a negative delta", async () => {
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/stock")) {
        return Promise.resolve(
          jsonResponse({
            status: "success",
            message: "Stock actualizado.",
            data: { item: { id: "item-1", itemType: "bike", itemId: "bike-1", sku: "BK-M-RED", onHand: 4, reserved: 1, available: 3, lowStockThresholdUnits: 5, createdAt: "", updatedAt: "" } },
          }),
        );
      }
      return Promise.resolve(detailResponse(makeDetail([makeVariant()])));
    });
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    renderModal({ detail: makeDetail([]) });

    await screen.findByText("Rojo");
    await user.click(screen.getByRole("button", { name: "Restar unidades" }));

    const call = await vi.waitFor(() => {
      const found = fetchSpy.mock.calls.find((args: unknown[]) => (args[0] as string).includes("/stock"));
      if (!found) throw new Error("not called yet");
      return found;
    });
    expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({ delta: -1 });
  });

  it("'+' on an untracked variant POSTs a new row; '-' is disabled", async () => {
    const fetchSpy = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return Promise.resolve(
          jsonResponse(
            {
              status: "success",
              message: "Entrada de inventario creada.",
              data: { item: { id: "item-new", itemType: "bike", itemId: "bike-1", sku: "BK-L-RED", onHand: 1, reserved: 0, available: 1, lowStockThresholdUnits: 5, createdAt: "", updatedAt: "" } },
            },
            201,
          ),
        );
      }
      return Promise.resolve(detailResponse(makeDetail([makeVariant({ inventoryItemId: null, onHand: 0, reserved: 0, available: 0 })])));
    });
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    renderModal({ detail: makeDetail([]) });

    await screen.findByText("Sin registro");
    expect(screen.getByRole("button", { name: "Restar unidades" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Sumar unidades" }));

    function isPostCall(args: unknown[]): boolean {
      return (args[1] as RequestInit | undefined)?.method === "POST";
    }

    await waitFor(() => {
      expect(fetchSpy.mock.calls.find(isPostCall)).toBeDefined();
    });
    const call = fetchSpy.mock.calls.find(isPostCall)!;
    expect(call[0]).toBe("/api/v1/admin/inventory");
    expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({
      itemType: "bike",
      itemId: "bike-1",
      sku: "BK-M-RED",
      onHand: 1,
    });
  });

  it("a 409 surfaces the server message and refetches the detail", async () => {
    let stockCallCount = 0;
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/stock")) {
        stockCallCount += 1;
        return Promise.resolve(
          jsonResponse({ status: "fail", message: "El ajuste dejaría el stock físico por debajo de las unidades ya reservadas." }, 409),
        );
      }
      return Promise.resolve(detailResponse(makeDetail([makeVariant()])));
    });
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    renderModal({ detail: makeDetail([]) });

    await screen.findByText("Rojo");
    await user.click(screen.getByRole("button", { name: "Restar unidades" }));

    expect(await screen.findByText("No se pudo ajustar")).toBeInTheDocument();
    expect(await screen.findByText(/por debajo de las unidades ya reservadas/)).toBeInTheDocument();
    expect(stockCallCount).toBe(1);
  });

  it("renders 'Bajo pedido' with no stepper for an on_request variant", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        detailResponse(makeDetail([makeVariant({ fulfillmentMode: "on_request", inventoryItemId: null, onHand: 0, reserved: 0, available: 0 })])),
      ),
    );
    renderModal({ detail: makeDetail([]) });

    expect(await screen.findByText("Bajo pedido")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sumar unidades" })).not.toBeInTheDocument();
  });

  it("calls onMutated exactly once, on close, after a successful adjustment", async () => {
    const onMutated = vi.fn();
    const onClose = vi.fn();
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/stock")) {
        return Promise.resolve(
          jsonResponse({
            status: "success",
            message: "Stock actualizado.",
            data: { item: { id: "item-1", itemType: "bike", itemId: "bike-1", sku: "BK-M-RED", onHand: 6, reserved: 1, available: 5, lowStockThresholdUnits: 5, createdAt: "", updatedAt: "" } },
          }),
        );
      }
      return Promise.resolve(detailResponse(makeDetail([makeVariant()])));
    });
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    renderModal({ detail: makeDetail([]), onMutated, onClose });

    await screen.findByText("Rojo");
    await user.click(screen.getByRole("button", { name: "Sumar unidades" }));
    await screen.findByText("5", { selector: "span.font-display" });

    await user.click(screen.getByRole("button", { name: "Cerrar Tarmac SL7" }));

    expect(onMutated).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
