import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  adjustAdminInventoryStock,
  createAdminInventoryItem,
  getAdminInventoryProductDetail,
  getAdminInventorySummary,
  listAdminInventory,
  listAdminInventoryProducts,
} from "./admin-inventory";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("listAdminInventory", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends only whitelisted, non-empty params", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ status: "success", message: "OK", data: { items: [] }, meta: { total: 0, page: 1, pages: 1, limit: 20 } }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    await listAdminInventory({ page: 2, itemType: "bike", stock: "low", category: "" });

    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/v1/admin/inventory?page=2&itemType=bike&stock=low");
  });

  it("sends no querystring when every param is omitted", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ status: "success", message: "OK", data: { items: [] }, meta: { total: 0, page: 1, pages: 1, limit: 20 } }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    await listAdminInventory({});

    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/v1/admin/inventory");
  });

  it("propagates a fail envelope as an ApiError with httpStatus", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ status: "fail", message: "Para filtrar por categoría también debes indicar el tipo de producto." }, 400)),
    );

    await expect(listAdminInventory({ category: "abc" })).rejects.toMatchObject({ httpStatus: 400 });
  });
});

describe("getAdminInventorySummary", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("GETs /admin/inventory/summary and unwraps summary", async () => {
    const totals = { totalSkus: 0, outOfStockSkus: 0, lowStockSkus: 0, newSkus: 0 };
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { summary: { totals } } }));
    vi.stubGlobal("fetch", fetchSpy);

    const summary = await getAdminInventorySummary();

    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/v1/admin/inventory/summary");
    expect(summary).toEqual({ totals });
  });
});

describe("createAdminInventoryItem", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("POSTs the input and returns the created item", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({ status: "success", message: "Entrada de inventario creada.", data: { item: { id: "1", sku: "BK-1" } } }, 201),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const item = await createAdminInventoryItem({ itemType: "bike", itemId: "abc", sku: "BK-1", onHand: 5 });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ itemType: "bike", itemId: "abc", sku: "BK-1", onHand: 5 });
    expect(item).toEqual({ id: "1", sku: "BK-1" });
  });
});

describe("adjustAdminInventoryStock", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("PATCHes with the delta payload", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: "success", message: "Stock actualizado.", data: { item: { id: "1", onHand: 8 } } }));
    vi.stubGlobal("fetch", fetchSpy);

    await adjustAdminInventoryStock("1", { delta: 3, reason: "Recepción de embarque" });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/admin/inventory/1/stock");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ delta: 3, reason: "Recepción de embarque" });
  });

  it("PATCHes without a reason key when none is given — the point of making Motivo optional", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: "success", message: "Stock actualizado.", data: { item: { id: "1", onHand: 8 } } }));
    vi.stubGlobal("fetch", fetchSpy);

    await adjustAdminInventoryStock("1", { delta: 3 });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ delta: 3 });
  });
});

describe("listAdminInventoryProducts", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("always sends itemType, plus only whitelisted non-empty params", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({
        status: "success",
        message: "OK",
        data: { products: [], counts: { all: 0, out: 0, low: 0, ok: 0, onRequest: 0 } },
        meta: { total: 0, page: 1, pages: 1, limit: 20 },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await listAdminInventoryProducts({ itemType: "bike", search: "trek", stock: "low", category: "" });

    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/v1/admin/inventory/products?itemType=bike&stock=low&search=trek");
  });

  it("sends only itemType when every other param is omitted", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({
        status: "success",
        message: "OK",
        data: { products: [], counts: { all: 0, out: 0, low: 0, ok: 0, onRequest: 0 } },
        meta: { total: 0, page: 1, pages: 1, limit: 20 },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await listAdminInventoryProducts({ itemType: "accessory" });

    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/v1/admin/inventory/products?itemType=accessory");
  });
});

describe("getAdminInventoryProductDetail", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("GETs the product detail with itemType and unwraps product", async () => {
    const product = { itemType: "bike", itemId: "abc", name: "Tarmac", brand: "Specialized", categoryName: "Ruta", variants: [] };
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { product } }));
    vi.stubGlobal("fetch", fetchSpy);

    const detail = await getAdminInventoryProductDetail("bike", "abc");

    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/v1/admin/inventory/products/abc?itemType=bike");
    expect(detail).toEqual(product);
  });
});
