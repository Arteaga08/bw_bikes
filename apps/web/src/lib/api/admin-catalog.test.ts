import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminAccessoriesApi, adminBikeCategoriesApi, adminBikesApi } from "./admin-catalog";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("adminBikesApi.list", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends only whitelisted, non-empty params", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { bikes: [] }, meta: { total: 0, page: 1, pages: 1, limit: 20 } }));
    vi.stubGlobal("fetch", fetchSpy);

    await adminBikesApi.list({ page: 2, search: "tarmac", isActive: true, minPrice: 100 });

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toBe("/api/v1/admin/bikes?page=2&search=tarmac&minPrice=100&isActive=true");
  });

  it("sends no querystring when every param is omitted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { bikes: [] } })),
    );
    const fetchSpy = vi.mocked(fetch);

    await adminBikesApi.list();

    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/v1/admin/bikes");
  });

  it("resolves with the bikes array and meta", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          status: "success",
          message: "OK",
          data: { bikes: [{ id: "1" }] },
          meta: { total: 1, page: 1, pages: 1, limit: 20 },
        }),
      ),
    );

    const result = await adminBikesApi.list({});
    expect(result.data).toEqual([{ id: "1" }]);
    expect(result.meta?.total).toBe(1);
  });
});

describe("adminBikesApi mutations", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs to /admin/bikes and unwraps { bike }", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: "success", message: "Creada.", data: { bike: { id: "1" } } }, 201));
    vi.stubGlobal("fetch", fetchSpy);

    const bike = await adminBikesApi.create({
      name: "Tarmac",
      brand: "Specialized",
      category: "cat-1",
      description: "desc",
      price: 100,
      shortDescription: "short",
    });

    expect(fetchSpy).toHaveBeenCalledWith("/api/v1/admin/bikes", expect.objectContaining({ method: "POST" }));
    expect(bike).toEqual({ id: "1" });
  });

  it("PATCHes /admin/bikes/:id and unwraps { bike }", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: "success", message: "Actualizada.", data: { bike: { id: "1", price: 200 } } }));
    vi.stubGlobal("fetch", fetchSpy);

    await adminBikesApi.update("1", { price: 200 } as never);

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/admin/bikes/1");
    expect(init.method).toBe("PATCH");
  });

  it("archive/restore hit their dedicated endpoints", async () => {
    // `mockImplementation`, not `mockResolvedValue` — a `Response` body can
    // only be read once, and this test calls `fetch` twice.
    const fetchSpy = vi
      .fn()
      .mockImplementation(() => jsonResponse({ status: "success", message: "OK", data: { bike: { id: "1" } } }));
    vi.stubGlobal("fetch", fetchSpy);

    await adminBikesApi.archive("1");
    expect(fetchSpy).toHaveBeenCalledWith("/api/v1/admin/bikes/1/archive", expect.objectContaining({ method: "POST" }));

    await adminBikesApi.restore("1");
    expect(fetchSpy).toHaveBeenCalledWith("/api/v1/admin/bikes/1/restore", expect.objectContaining({ method: "POST" }));
  });

  it("replaceSpecGroups PUTs the whole array and returns { specGroups }", async () => {
    const groups = [{ title: "Cuadro", order: 0, fields: [] }];
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { specGroups: groups } }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await adminBikesApi.replaceSpecGroups("1", groups);

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/admin/bikes/1/spec-groups");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ groups });
    expect(result).toEqual(groups);
  });

  it("propagates a fail envelope as an ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ status: "fail", message: "Ya existe un producto con ese slug." }, 409)),
    );

    await expect(adminBikesApi.create({} as never)).rejects.toMatchObject({ httpStatus: 409 });
  });
});

describe("adminAccessoriesApi shares the same shape under its own base path", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists under /admin/accessories and unwraps { accessories }", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { accessories: [{ id: "a1" }] } }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await adminAccessoriesApi.list({ search: "casco" });

    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/v1/admin/accessories?search=casco");
    expect(result.data).toEqual([{ id: "a1" }]);
  });
});

describe("adminBikeCategoriesApi", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("tree() unwraps { tree }", async () => {
    const tree = [{ id: "1", name: "Montaña", slug: "montana", parent: null, order: 0, isActive: true, createdAt: "", updatedAt: "", children: [] }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { tree } })));

    const result = await adminBikeCategoriesApi.tree();
    expect(result).toEqual(tree);
  });

  it("remove() DELETEs the category by id", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ status: "success", message: "Eliminada." }));
    vi.stubGlobal("fetch", fetchSpy);

    await adminBikeCategoriesApi.remove("1");

    expect(fetchSpy).toHaveBeenCalledWith("/api/v1/admin/bike-categories/1", expect.objectContaining({ method: "DELETE" }));
  });

  it("propagates the 409 blocking-count message on a non-empty category", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ status: "fail", message: "No se puede eliminar la categoría porque tiene 2 producto(s)." }, 409),
      ),
    );

    await expect(adminBikeCategoriesApi.remove("1")).rejects.toMatchObject({
      httpStatus: 409,
      message: expect.stringContaining("producto"),
    });
  });
});
