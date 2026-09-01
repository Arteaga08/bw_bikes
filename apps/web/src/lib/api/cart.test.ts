import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addCartLine,
  applyCartCoupon,
  clearCart,
  getCart,
  removeCartCoupon,
  removeCartLine,
  updateCartLine,
} from "./cart";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const CART = { id: "cart-1", lines: [], subtotalCents: 0 };

describe("cart api", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("getCart hits GET /cart", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { cart: CART } }));
    vi.stubGlobal("fetch", fetchSpy);

    const cart = await getCart();

    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/v1/cart");
    expect(cart).toEqual(CART);
  });

  it("addCartLine POSTs to /cart/lines with the line payload", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { cart: CART } }));
    vi.stubGlobal("fetch", fetchSpy);

    await addCartLine("bike", "item-1", "SKU-1", 2);

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/v1/cart/lines");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ itemType: "bike", itemId: "item-1", sku: "SKU-1", qty: 2 });
  });

  it("updateCartLine PATCHes /cart/lines/:itemType/:sku with an absolute qty", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { cart: CART } }));
    vi.stubGlobal("fetch", fetchSpy);

    await updateCartLine("accessory", "SKU-2", 3);

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/v1/cart/lines/accessory/SKU-2");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ qty: 3 });
  });

  it("removeCartLine DELETEs /cart/lines/:itemType/:sku", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { cart: CART } }));
    vi.stubGlobal("fetch", fetchSpy);

    await removeCartLine("bike", "SKU-1");

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/v1/cart/lines/bike/SKU-1");
    expect(init.method).toBe("DELETE");
  });

  it("clearCart DELETEs /cart", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { cart: CART } }));
    vi.stubGlobal("fetch", fetchSpy);

    await clearCart();

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/v1/cart");
    expect(init.method).toBe("DELETE");
  });

  it("applyCartCoupon POSTs the code to /cart/coupon", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { cart: CART } }));
    vi.stubGlobal("fetch", fetchSpy);

    await applyCartCoupon("VERANO10");

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/v1/cart/coupon");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ code: "VERANO10" });
  });

  it("removeCartCoupon DELETEs /cart/coupon", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { cart: CART } }));
    vi.stubGlobal("fetch", fetchSpy);

    await removeCartCoupon();

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/v1/cart/coupon");
    expect(init.method).toBe("DELETE");
  });

  it("resolves a 401 to a catchable ApiError instead of navigating away", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ status: "fail", message: "No autenticado." }, 401)),
    );

    await expect(getCart()).rejects.toMatchObject({ httpStatus: 401 });
  });
});
