import type { PublicCart } from "@bw-bikes/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useCartMock, createOrderMock, useRouterMock, confirmPaymentMock, submitMock, useStripeMock, useElementsMock, pushMock } =
  vi.hoisted(() => ({
    useCartMock: vi.fn(),
    createOrderMock: vi.fn(),
    useRouterMock: vi.fn(),
    confirmPaymentMock: vi.fn(),
    submitMock: vi.fn(),
    useStripeMock: vi.fn(),
    useElementsMock: vi.fn(),
    pushMock: vi.fn(),
  }));

vi.mock("@/components/cart/CartProvider", () => ({ useCart: useCartMock }));
vi.mock("@/lib/api/checkout", () => ({ createOrder: createOrderMock }));
vi.mock("next/navigation", () => ({ useRouter: useRouterMock }));
vi.mock("@/components/checkout/PaymentElementCard", () => ({
  PaymentElementCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
// No auto-fire of `onReady` — a dedicated test below verifies the Pagar
// button stays disabled until it fires; every other test clicks
// `fire-element-ready` once to get past that gate, the same way a real mount
// eventually resolves.
vi.mock("@stripe/react-stripe-js", () => ({
  PaymentElement: ({ onReady }: { onReady?: () => void }) => (
    <div>
      <div data-testid="payment-element" />
      <button type="button" data-testid="fire-element-ready" onClick={onReady}>
        simulate Stripe mount finishing
      </button>
    </div>
  ),
  useStripe: useStripeMock,
  useElements: useElementsMock,
}));

const { PaymentCard } = await import("./PaymentCard");
// Las pruebas de comportamiento montan `PaymentFields` directo: `PaymentCard`
// ahora solo decide entre el placeholder y esos campos, y los carga con
// `next/dynamic` (ver la prueba de esa frontera más abajo).
const { PaymentFields } = await import("./PaymentFields");
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
    firstName: "Ana",
    lastName: "Pérez",
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

function stripeFake(overrides: Partial<{ confirmError: { type: string; message: string } }> = {}) {
  confirmPaymentMock.mockResolvedValue(overrides.confirmError ? { error: overrides.confirmError } : { paymentIntent: { status: "succeeded" } });
  useStripeMock.mockReturnValue({ confirmPayment: confirmPaymentMock });
  submitMock.mockResolvedValue({});
  useElementsMock.mockReturnValue({ submit: submitMock });
}

/** Checks the terms box and fires the Element's `onReady` — every test that clicks Pagar starts here. */
async function acceptTermsAndReady(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByTestId("fire-element-ready"));
}

describe("PaymentCard", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    useRouterMock.mockReturnValue({ push: pushMock });
    stripeFake();
  });

  it("shows a placeholder and never mounts the card fields when the step is not open", () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });

    render(<PaymentCard open={false} />);

    expect(screen.getByText("Completa tu dirección de envío para continuar al pago.")).toBeInTheDocument();
    expect(screen.queryByTestId("payment-element")).not.toBeInTheDocument();
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it("shows a placeholder when there is no shipping address yet, even if open", () => {
    useCartMock.mockReturnValue({ cart: { ...PURCHASABLE_CART, shippingAddress: undefined } });

    render(<PaymentCard open />);

    expect(screen.getByText("Completa tu dirección de envío para continuar al pago.")).toBeInTheDocument();
    expect(screen.queryByTestId("payment-element")).not.toBeInTheDocument();
  });

  it("mounts the card fields when open, with no prior click and no order created yet", () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });

    render(<PaymentFields />);

    expect(screen.getByTestId("payment-element")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it("carga los campos de pago bajo demanda cuando el paso se abre, sin crear ninguna orden", async () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });

    render(<PaymentCard open />);

    // El chunk de Stripe llega después del primer render — esa espera *es* el
    // punto de la prueba: verifica que la frontera `next/dynamic` resuelve y
    // que abrir el paso sigue sin tocar el backend.
    expect(await screen.findByTestId("payment-element")).toBeInTheDocument();
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it("Pagar stays disabled until both the terms are accepted and the Element reports ready", async () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });
    const user = userEvent.setup();

    render(<PaymentFields />);

    expect(screen.getByRole("button", { name: /Pagar/ })).toBeDisabled();
    expect(screen.getByText("Acepta los términos para habilitar el pago.")).toBeInTheDocument();

    await user.click(screen.getByTestId("fire-element-ready"));
    expect(screen.getByRole("button", { name: /Pagar/ })).toBeDisabled();

    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: /Pagar/ })).toBeEnabled();
  });

  it("never calls createOrder or confirmPayment while Pagar is disabled", () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });

    render(<PaymentFields />);

    expect(screen.getByRole("button", { name: /Pagar/ })).toBeDisabled();
    expect(createOrderMock).not.toHaveBeenCalled();
    expect(confirmPaymentMock).not.toHaveBeenCalled();
  });

  it("shows 'Autorizar $X' when the cart preview's captureMethod is manual", () => {
    useCartMock.mockReturnValue({ cart: { ...PURCHASABLE_CART, captureMethod: "manual" } });

    render(<PaymentFields />);

    expect(screen.getByRole("button", { name: /Autorizar/ })).toBeInTheDocument();
    expect(
      screen.getByText("El cargo se autoriza ahora y se cobra cuando el proveedor confirme el stock."),
    ).toBeInTheDocument();
  });

  it("shows 'Pagar $X' when the cart preview's captureMethod is automatic", () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });

    render(<PaymentFields />);

    expect(screen.getByRole("button", { name: /Pagar/ })).toBeInTheDocument();
  });

  it("does not call createOrder when elements.submit() reports an incomplete card", async () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });
    submitMock.mockResolvedValueOnce({ error: { message: "Completa los datos de tu tarjeta." } });
    const user = userEvent.setup();

    render(<PaymentFields />);
    await acceptTermsAndReady(user);
    await user.click(screen.getByRole("button", { name: /Pagar/ }));

    await waitFor(() => expect(screen.getByText("Completa los datos de tu tarjeta.")).toBeInTheDocument());
    expect(createOrderMock).not.toHaveBeenCalled();
    expect(confirmPaymentMock).not.toHaveBeenCalled();
  });

  it("creates the order only once Pagar is pressed, with a real consent timestamp", async () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });
    createOrderMock.mockResolvedValue(CHECKOUT_RESULT);
    const user = userEvent.setup();

    render(<PaymentFields />);
    await acceptTermsAndReady(user);
    expect(createOrderMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Pagar/ }));

    await waitFor(() => expect(createOrderMock).toHaveBeenCalledTimes(1));
    const [termsAcceptedAt] = createOrderMock.mock.calls[0]!;
    expect(new Date(termsAcceptedAt as string).toString()).not.toBe("Invalid Date");
  });

  it("confirms the payment and redirects to /gracias/:orderNumber on success", async () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });
    createOrderMock.mockResolvedValue(CHECKOUT_RESULT);
    const user = userEvent.setup();

    render(<PaymentFields />);
    await acceptTermsAndReady(user);
    await user.click(screen.getByRole("button", { name: /Pagar/ }));

    await waitFor(() => expect(confirmPaymentMock).toHaveBeenCalledTimes(1));
    expect(confirmPaymentMock.mock.calls[0]![0]).toMatchObject({
      clientSecret: "pi_123_secret_abc",
      redirect: "if_required",
      confirmParams: { return_url: expect.stringContaining("/gracias/BW-0001") },
    });
    expect(pushMock).toHaveBeenCalledWith("/gracias/BW-0001");
  });

  it("reuses the same idempotency key across two mounts with the same cart.updatedAt", async () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });
    createOrderMock.mockResolvedValue(CHECKOUT_RESULT);

    let user = userEvent.setup();
    const { unmount } = render(<PaymentFields />);
    await acceptTermsAndReady(user);
    await user.click(screen.getByRole("button", { name: /Pagar/ }));
    await waitFor(() => expect(createOrderMock).toHaveBeenCalledTimes(1));
    const firstKey = createOrderMock.mock.calls[0]![1];
    unmount();

    user = userEvent.setup();
    render(<PaymentFields />);
    await acceptTermsAndReady(user);
    await user.click(screen.getByRole("button", { name: /Pagar/ }));
    await waitFor(() => expect(createOrderMock).toHaveBeenCalledTimes(2));
    expect(createOrderMock.mock.calls[1]![1]).toBe(firstKey);
  });

  it("generates a new idempotency key when cart.updatedAt changes between mounts", async () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });
    createOrderMock.mockResolvedValue(CHECKOUT_RESULT);

    let user = userEvent.setup();
    const { unmount } = render(<PaymentFields />);
    await acceptTermsAndReady(user);
    await user.click(screen.getByRole("button", { name: /Pagar/ }));
    await waitFor(() => expect(createOrderMock).toHaveBeenCalledTimes(1));
    const firstKey = createOrderMock.mock.calls[0]![1];
    unmount();

    useCartMock.mockReturnValue({ cart: { ...PURCHASABLE_CART, updatedAt: "2026-09-01T00:05:00.000Z" } });
    user = userEvent.setup();
    render(<PaymentFields />);
    await acceptTermsAndReady(user);
    await user.click(screen.getByRole("button", { name: /Pagar/ }));
    await waitFor(() => expect(createOrderMock).toHaveBeenCalledTimes(2));
    expect(createOrderMock.mock.calls[1]![1]).not.toBe(firstKey);
  });

  it("aborts without confirming payment when the server's total disagrees with the cart preview", async () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });
    createOrderMock.mockResolvedValue({
      order: { ...ORDER, totals: { ...ORDER.totals, totalCents: 999999 } },
      clientSecret: "pi_123_secret_abc",
    });
    const user = userEvent.setup();

    render(<PaymentFields />);
    await acceptTermsAndReady(user);
    await user.click(screen.getByRole("button", { name: /Pagar/ }));

    await waitFor(() => expect(screen.getByText("El total de tu pedido cambió. Vuelve al carrito para revisarlo.")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /carrito/i })).toHaveAttribute("href", "/carrito");
    expect(confirmPaymentMock).not.toHaveBeenCalled();
  });

  it("aborts without confirming payment when the server's captureMethod disagrees with the cart preview", async () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });
    createOrderMock.mockResolvedValue({
      order: { ...ORDER, payment: { ...ORDER.payment, captureMethod: "manual" } },
      clientSecret: "pi_123_secret_abc",
    });
    const user = userEvent.setup();

    render(<PaymentFields />);
    await acceptTermsAndReady(user);
    await user.click(screen.getByRole("button", { name: /Pagar/ }));

    await waitFor(() => expect(screen.getByText("El total de tu pedido cambió. Vuelve al carrito para revisarlo.")).toBeInTheDocument());
    expect(confirmPaymentMock).not.toHaveBeenCalled();
  });

  it("shows a card_error message inline and keeps the form mounted", async () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });
    createOrderMock.mockResolvedValue(CHECKOUT_RESULT);
    stripeFake({ confirmError: { type: "card_error", message: "Tu tarjeta fue rechazada." } });
    const user = userEvent.setup();

    render(<PaymentFields />);
    await acceptTermsAndReady(user);
    await user.click(screen.getByRole("button", { name: /Pagar/ }));

    await waitFor(() => expect(screen.getByText("Tu tarjeta fue rechazada.")).toBeInTheDocument());
    expect(screen.getByTestId("payment-element")).toBeInTheDocument();
  });

  it("shows a generic message for a non-card Stripe error type", async () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });
    createOrderMock.mockResolvedValue(CHECKOUT_RESULT);
    stripeFake({ confirmError: { type: "api_error", message: "raw stripe internals, never shown" } });
    const user = userEvent.setup();

    render(<PaymentFields />);
    await acceptTermsAndReady(user);
    await user.click(screen.getByRole("button", { name: /Pagar/ }));

    await waitFor(() => expect(screen.getByText("No se pudo procesar el pago. Intenta de nuevo.")).toBeInTheDocument());
    expect(screen.queryByText("raw stripe internals, never shown")).not.toBeInTheDocument();
  });

  it("shows a ButtonLink to /carrito when createOrder fails with 409", async () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });
    createOrderMock.mockRejectedValue(new ApiError("La orden BW-0001 ya fue procesada.", 409));
    const user = userEvent.setup();

    render(<PaymentFields />);
    await acceptTermsAndReady(user);
    await user.click(screen.getByRole("button", { name: /Pagar/ }));

    await waitFor(() => expect(screen.getByText("La orden BW-0001 ya fue procesada.")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /carrito/i })).toHaveAttribute("href", "/carrito");
  });

  it("retries createOrder with the same key when Pagar is pressed again after a 502", async () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });
    createOrderMock.mockRejectedValueOnce(new ApiError("Fallo del proveedor de pagos.", 502));
    createOrderMock.mockResolvedValueOnce(CHECKOUT_RESULT);
    const user = userEvent.setup();

    render(<PaymentFields />);
    await acceptTermsAndReady(user);
    await user.click(screen.getByRole("button", { name: /Pagar/ }));
    await waitFor(() => expect(screen.getByText("Fallo del proveedor de pagos.")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Pagar/ }));

    await waitFor(() => expect(confirmPaymentMock).toHaveBeenCalledTimes(1));
    expect(createOrderMock).toHaveBeenCalledTimes(2);
    expect(createOrderMock.mock.calls[0]![1]).toBe(createOrderMock.mock.calls[1]![1]);
  });

  it("shows the backend message and a ButtonLink to /carrito on 400 (empty cart / invalid quantity)", async () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });
    createOrderMock.mockRejectedValue(new ApiError("Tu carrito está vacío.", 400));
    const user = userEvent.setup();

    render(<PaymentFields />);
    await acceptTermsAndReady(user);
    await user.click(screen.getByRole("button", { name: /Pagar/ }));

    await waitFor(() => expect(screen.getByText("Tu carrito está vacío.")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /carrito/i })).toHaveAttribute("href", "/carrito");
  });

  it("disables Pagar on 503 (maintenance) and never calls confirmPayment", async () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART });
    createOrderMock.mockRejectedValue(new ApiError("El pago con tarjeta no está disponible por ahora.", 503));
    const user = userEvent.setup();

    render(<PaymentFields />);
    await acceptTermsAndReady(user);
    await user.click(screen.getByRole("button", { name: /Pagar/ }));

    await waitFor(() => expect(screen.getByText("El pago con tarjeta no está disponible por ahora.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Pagar/ })).toBeDisabled();
    expect(confirmPaymentMock).not.toHaveBeenCalled();
  });
});
