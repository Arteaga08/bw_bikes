import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  bulkUpdateOrderStatus,
  confirmSupplierStock,
  listAdminOrders,
  rejectSupplierStock,
} from "./admin-orders";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("listAdminOrders", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends only whitelisted, non-empty params", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { orders: [] }, meta: { total: 0, page: 1, pages: 1, limit: 20 } }));
    vi.stubGlobal("fetch", fetchSpy);

    await listAdminOrders({ page: 2, status: "awaiting_supplier_confirmation", orderNumber: "" });

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toBe("/api/v1/admin/orders?page=2&status=awaiting_supplier_confirmation");
  });

  it("joins a status array into one comma-separated query value", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { orders: [] }, meta: { total: 0, page: 1, pages: 1, limit: 20 } }));
    vi.stubGlobal("fetch", fetchSpy);

    await listAdminOrders({ status: ["paid", "processing"] });

    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/v1/admin/orders?status=paid%2Cprocessing");
  });

  it("sends the search param", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { orders: [] }, meta: { total: 0, page: 1, pages: 1, limit: 20 } }));
    vi.stubGlobal("fetch", fetchSpy);

    await listAdminOrders({ search: "Manuel" });

    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/v1/admin/orders?search=Manuel");
  });

  it("sends no querystring when every param is omitted", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { orders: [] }, meta: { total: 0, page: 1, pages: 1, limit: 20 } }));
    vi.stubGlobal("fetch", fetchSpy);

    await listAdminOrders({});

    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/v1/admin/orders");
  });

  it("resolves with orders and meta", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          status: "success",
          message: "Órdenes obtenidas.",
          data: { orders: [{ id: "1" }] },
          meta: { total: 1, page: 1, pages: 1, limit: 20 },
        }),
      ),
    );

    const result = await listAdminOrders({});
    expect(result.data.orders).toHaveLength(1);
    expect(result.meta?.total).toBe(1);
  });
});

describe("confirmSupplierStock / rejectSupplierStock", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs to confirm-supplier-stock and returns the order", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({ status: "success", message: "Stock confirmado y pago capturado.", data: { order: { id: "1", status: "paid" } } }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const order = await confirmSupplierStock("1");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/v1/admin/orders/1/confirm-supplier-stock",
      expect.objectContaining({ method: "POST" }),
    );
    expect(order).toEqual({ id: "1", status: "paid" });
  });

  it("POSTs the reason to reject-supplier-stock", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({ status: "success", message: "Autorización cancelada y unidades liberadas.", data: { order: { id: "1", status: "cancelled" } } }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await rejectSupplierStock("1", "Proveedor sin existencias.");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ reason: "Proveedor sin existencias." });
  });

  it("propagates a rejection as an ApiError (e.g. order not awaiting confirmation)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ status: "fail", message: "Esta orden no está esperando confirmación del proveedor." }, 409),
      ),
    );

    await expect(confirmSupplierStock("1")).rejects.toMatchObject({ httpStatus: 409 });
  });
});

describe("bulkUpdateOrderStatus", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("always resolves (200) even when every order was rejected — summary carries the outcome", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          status: "success",
          message: "Actualización masiva procesada.",
          data: {
            results: [{ id: "1", orderNumber: "BW-2026-K7XQ2M", outcome: "rejected", message: "No se puede pasar una orden pagada a entregada." }],
            summary: { updated: 0, unchanged: 0, rejected: 1 },
          },
        }),
      ),
    );

    const result = await bulkUpdateOrderStatus(["1"], "delivered");
    expect(result.summary).toEqual({ updated: 0, unchanged: 0, rejected: 1 });
    expect(result.results[0]?.outcome).toBe("rejected");
  });
});
