import type { CheckoutResult, PublicOrder } from "@bw-bikes/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./error";
import { createOrder, getOrderByNumber } from "./checkout";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const ORDER = { id: "order-1", orderNumber: "BW-0001" } as unknown as PublicOrder;
const CHECKOUT_RESULT: CheckoutResult = { order: ORDER, clientSecret: "pi_123_secret_abc" };

describe("checkout api", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("createOrder POSTs to /orders with the Idempotency-Key header when a key is given", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: CHECKOUT_RESULT }, 201));
    vi.stubGlobal("fetch", fetchSpy);

    await createOrder("idem-key-1");

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/v1/orders");
    expect(init.method).toBe("POST");
    expect(init.headers["Idempotency-Key"]).toBe("idem-key-1");
  });

  it("createOrder omits the header when no key is given", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: CHECKOUT_RESULT }, 201));
    vi.stubGlobal("fetch", fetchSpy);

    await createOrder();

    const [, init] = fetchSpy.mock.calls[0]!;
    expect(init.headers["Idempotency-Key"]).toBeUndefined();
  });

  it("createOrder returns the order and clientSecret", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: CHECKOUT_RESULT }, 201)));

    const result = await createOrder("idem-key-1");

    expect(result).toEqual(CHECKOUT_RESULT);
  });

  it("createOrder rejects with an ApiError carrying the backend message on 409", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ status: "error", message: "La orden BW-0001 ya fue procesada." }, 409)),
    );

    await expect(createOrder("idem-key-1")).rejects.toMatchObject({ httpStatus: 409, message: "La orden BW-0001 ya fue procesada." });
  });

  it("createOrder rejects with an ApiError on 400", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ status: "error", message: "Agrega una dirección de envío antes de continuar." }, 400)),
    );

    await expect(createOrder("idem-key-1")).rejects.toMatchObject({ httpStatus: 400 });
  });

  it("createOrder rejects with an ApiError on 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ status: "error", message: "Demasiados intentos de compra. Espera unos minutos e intenta de nuevo." }, 429),
        ),
    );

    await expect(createOrder("idem-key-1")).rejects.toMatchObject({ httpStatus: 429 });
  });

  it("createOrder rejects with an ApiError on 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: "error", message: "Fallo del proveedor de pagos." }, 502)));

    await expect(createOrder("idem-key-1")).rejects.toMatchObject({ httpStatus: 502 });
  });

  it("createOrder rejects with an ApiError on 503", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ status: "error", message: "El pago con tarjeta no está disponible por ahora." }, 503)),
    );

    await expect(createOrder("idem-key-1")).rejects.toMatchObject({ httpStatus: 503 });
  });

  it("getOrderByNumber GETs /orders/number/:orderNumber and returns the order", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ status: "success", message: "OK", data: { order: ORDER } }));
    vi.stubGlobal("fetch", fetchSpy);

    const order = await getOrderByNumber("BW-0001");

    const [url] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/v1/orders/number/BW-0001");
    expect(order).toEqual(ORDER);
  });

  it("getOrderByNumber propagates a 401 as a catchable ApiError instead of navigating", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: "error", message: "No autorizado." }, 401)));

    await expect(getOrderByNumber("BW-0001")).rejects.toBeInstanceOf(ApiError);
  });
});
