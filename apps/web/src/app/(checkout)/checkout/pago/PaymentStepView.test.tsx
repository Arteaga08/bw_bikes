import type { PublicCart } from "@bw-bikes/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useCartMock, createOrderMock, useRouterMock, confirmPaymentMock, useStripeMock, useElementsMock } = vi.hoisted(() => ({
  useCartMock: vi.fn(),
  createOrderMock: vi.fn(),
  useRouterMock: vi.fn(),
  confirmPaymentMock: vi.fn(),
  useStripeMock: vi.fn(),
  useElementsMock: vi.fn(),
}));

vi.mock("@/components/cart/CartProvider", () => ({ useCart: useCartMock }));
vi.mock("@/lib/api/checkout", () => ({ createOrder: createOrderMock }));
vi.mock("next/navigation", () => ({ useRouter: useRouterMock }));
vi.mock("@/components/checkout/PaymentElementCard", () => ({
  PaymentElementCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@stripe/react-stripe-js", () => ({
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: useStripeMock,
  useElements: useElementsMock,
}));

const { PaymentStepView } = await import("./PaymentStepView");
const { ApiError } = await import("@/lib/api/error");

const PURCHASABLE_CART: PublicCart = {
  id: "cart-1",
  lines: [
    {
      itemType: "bike",
      itemId: "i1",
      sku: "BK-1",
      slug: "bici",
      name: "Bici",
      brand: "BW",
      fulfillmentMode: "in_stock",
      unitPriceCents: 100000,
      qty: 1,
      lineTotalCents: 100000,
      available: 3,
      isPurchasable: true,
    },
  ],
  shippingAddress: {
    recipientName: "Ana Pérez",
    phone: "5512345678",
    street: "Av. Reforma 123",
    neighborhood: "Juárez",
    city: "CDMX",
    state: "Ciudad de México",
    postalCode: "06600",
    country: "MX",
  },
  subtotalCents: 100000,
  discountCents: 0,
  taxCents: 16000,
  shippingCents: 0,
  totalCents: 116000,
  currency: "MXN",
  captureMethod: "automatic",
  hasBlockingLines: false,
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const ORDER = {
  id: "order-1",
  orderNumber: "BW-0001",
  totals: { subtotalCents: 100000, discountCents: 0, taxCents: 16000, shippingCents: 0, totalCents: 116000 },
  payment: { provider: "stripe", state: "pending", captureMethod: "automatic" },
};
const CHECKOUT_RESULT = { order: ORDER, clientSecret: "pi_123_secret_abc" };

function stripeFake(overrides: Partial<{ error: { type: string; message: string } }> = {}) {
  confirmPaymentMock.mockResolvedValue(overrides.error ? { error: overrides.error } : { paymentIntent: { status: "succeeded" } });
  useStripeMock.mockReturnValue({ confirmPayment: confirmPaymentMock });
  useElementsMock.mockReturnValue({});
}

describe("PaymentStepView", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    useRouterMock.mockReturnValue({ replace: vi.fn(), push: vi.fn() });
    stripeFake();
  });

  it("redirects to /checkout/envio without calling createOrder when there is no shipping address", async () => {
    const replace = vi.fn();
    useRouterMock.mockReturnValue({ replace, push: vi.fn() });
    useCartMock.mockReturnValue({ cart: { ...PURCHASABLE_CART, shippingAddress: undefined } });

    render(<PaymentStepView />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/checkout/envio"));
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it("creates the order once on mount and renders the payment form", async () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });
    createOrderMock.mockResolvedValue(CHECKOUT_RESULT);

    render(<PaymentStepView />);

    await waitFor(() => expect(screen.getByTestId("payment-element")).toBeInTheDocument());
    expect(createOrderMock).toHaveBeenCalledTimes(1);
  });

  it("reuses the same idempotency key and does not call createOrder twice across two mounts with the same cart.updatedAt", async () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });
    createOrderMock.mockResolvedValue(CHECKOUT_RESULT);

    const { unmount } = render(<PaymentStepView />);
    await waitFor(() => expect(createOrderMock).toHaveBeenCalledTimes(1));
    const firstKey = createOrderMock.mock.calls[0]![0];
    unmount();

    render(<PaymentStepView />);
    await waitFor(() => expect(createOrderMock).toHaveBeenCalledTimes(2));
    expect(createOrderMock.mock.calls[1]![0]).toBe(firstKey);
  });

  it("generates a new idempotency key when cart.updatedAt changes between mounts", async () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });
    createOrderMock.mockResolvedValue(CHECKOUT_RESULT);

    const { unmount } = render(<PaymentStepView />);
    await waitFor(() => expect(createOrderMock).toHaveBeenCalledTimes(1));
    const firstKey = createOrderMock.mock.calls[0]![0];
    unmount();

    useCartMock.mockReturnValue({ cart: { ...PURCHASABLE_CART, updatedAt: "2026-09-01T00:05:00.000Z" } });
    render(<PaymentStepView />);
    await waitFor(() => expect(createOrderMock).toHaveBeenCalledTimes(2));
    expect(createOrderMock.mock.calls[1]![0]).not.toBe(firstKey);
  });

  it("shows 'Autorizar $X' instead of 'Pagar $X' when captureMethod is manual", async () => {
    useCartMock.mockReturnValue({ cart: { ...PURCHASABLE_CART, captureMethod: "manual" } });
    createOrderMock.mockResolvedValue({
      order: { ...ORDER, payment: { ...ORDER.payment, captureMethod: "manual" } },
      clientSecret: "pi_123_secret_abc",
    });

    render(<PaymentStepView />);

    await waitFor(() => expect(screen.getByRole("button", { name: /Autorizar/ })).toBeInTheDocument());
  });

  it("shows 'Pagar $X' when captureMethod is automatic", async () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });
    createOrderMock.mockResolvedValue(CHECKOUT_RESULT);

    render(<PaymentStepView />);

    await waitFor(() => expect(screen.getByRole("button", { name: /Pagar/ })).toBeInTheDocument());
  });

  it("shows a card_error message inline and keeps the form mounted", async () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });
    createOrderMock.mockResolvedValue(CHECKOUT_RESULT);
    stripeFake({ error: { type: "card_error", message: "Tu tarjeta fue rechazada." } });

    render(<PaymentStepView />);
    await waitFor(() => expect(screen.getByTestId("payment-element")).toBeInTheDocument());

    await userEvent.setup().click(screen.getByRole("button", { name: /Pagar/ }));

    await waitFor(() => expect(screen.getByText("Tu tarjeta fue rechazada.")).toBeInTheDocument());
    expect(screen.getByTestId("payment-element")).toBeInTheDocument();
  });

  it("shows a generic message for a non-card Stripe error type", async () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });
    createOrderMock.mockResolvedValue(CHECKOUT_RESULT);
    stripeFake({ error: { type: "api_error", message: "raw stripe internals, never shown" } });

    render(<PaymentStepView />);
    await waitFor(() => expect(screen.getByTestId("payment-element")).toBeInTheDocument());

    await userEvent.setup().click(screen.getByRole("button", { name: /Pagar/ }));

    await waitFor(() => expect(screen.getByText("No se pudo procesar el pago. Intenta de nuevo.")).toBeInTheDocument());
    expect(screen.queryByText("raw stripe internals, never shown")).not.toBeInTheDocument();
  });

  it("shows a ButtonLink to /carrito when createOrder fails with 409", async () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });
    createOrderMock.mockRejectedValue(new ApiError("La orden BW-0001 ya fue procesada.", 409));

    render(<PaymentStepView />);

    await waitFor(() => expect(screen.getByText("La orden BW-0001 ya fue procesada.")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /carrito/i })).toHaveAttribute("href", "/carrito");
  });

  it("shows a Reintentar button on 502 that retries createOrder with the same key", async () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });
    createOrderMock.mockRejectedValueOnce(new ApiError("Fallo del proveedor de pagos.", 502));
    createOrderMock.mockResolvedValueOnce(CHECKOUT_RESULT);

    render(<PaymentStepView />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument());

    await userEvent.setup().click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(screen.getByTestId("payment-element")).toBeInTheDocument());
    expect(createOrderMock).toHaveBeenCalledTimes(2);
    expect(createOrderMock.mock.calls[0]![0]).toBe(createOrderMock.mock.calls[1]![0]);
  });

  it("shows a maintenance block without the form on 503, and does not call confirmPayment", async () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });
    createOrderMock.mockRejectedValue(new ApiError("El pago con tarjeta no está disponible por ahora.", 503));

    render(<PaymentStepView />);

    await waitFor(() => expect(screen.getByText("El pago con tarjeta no está disponible por ahora.")).toBeInTheDocument());
    expect(screen.queryByTestId("payment-element")).not.toBeInTheDocument();
  });
});
