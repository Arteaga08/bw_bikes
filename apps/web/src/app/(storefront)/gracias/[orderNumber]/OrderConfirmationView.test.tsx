import type { PublicOrder } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getOrderByNumberMock, refreshMock, useCartMock } = vi.hoisted(() => ({
  getOrderByNumberMock: vi.fn(),
  refreshMock: vi.fn(),
  useCartMock: vi.fn(() => ({ refresh: refreshMock })),
}));

vi.mock("@/lib/api/checkout", () => ({ getOrderByNumber: getOrderByNumberMock }));
vi.mock("@/components/cart/CartProvider", () => ({ useCart: useCartMock }));

const { OrderConfirmationView } = await import("./OrderConfirmationView");

function order(overrides: Partial<PublicOrder>): PublicOrder {
  return {
    id: "order-1",
    orderNumber: "BW-0001",
    status: "pending_payment",
    priority: "normal",
    lines: [],
    totals: { subtotalCents: 100000, discountCents: 0, taxCents: 16000, shippingCents: 0, totalCents: 116000 },
    payment: { provider: "stripe", state: "pending", captureMethod: "automatic" },
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
    statusHistory: [],
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  } as PublicOrder;
}

describe("OrderConfirmationView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    useCartMock.mockReturnValue({ refresh: refreshMock });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the waiting screen while payment.state is pending", async () => {
    getOrderByNumberMock.mockResolvedValue(order({ payment: { provider: "stripe", state: "pending", captureMethod: "automatic" } }));

    render(<OrderConfirmationView orderNumber="BW-0001" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Estamos confirmando tu pago…")).toBeInTheDocument();
  });

  it("shows the success screen once status becomes paid, and stops polling", async () => {
    getOrderByNumberMock
      .mockResolvedValueOnce(order({ payment: { provider: "stripe", state: "pending", captureMethod: "automatic" } }))
      .mockResolvedValueOnce(order({ status: "paid", payment: { provider: "stripe", state: "captured", captureMethod: "automatic" } }));

    render(<OrderConfirmationView orderNumber="BW-0001" />);
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.getByText("Pedido confirmado")).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalledTimes(1);

    getOrderByNumberMock.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(getOrderByNumberMock).not.toHaveBeenCalled();
  });

  it("shows the supplier-authorization screen for awaiting_supplier_confirmation", async () => {
    getOrderByNumberMock.mockResolvedValue(
      order({ status: "awaiting_supplier_confirmation", payment: { provider: "stripe", state: "authorized", captureMethod: "manual" } }),
    );

    render(<OrderConfirmationView orderNumber="BW-0001" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Pago autorizado")).toBeInTheDocument();
  });

  it("shows the failure screen when payment.state is failed, pointing at /carrito", async () => {
    getOrderByNumberMock.mockResolvedValue(order({ payment: { provider: "stripe", state: "failed", captureMethod: "automatic" } }));

    render(<OrderConfirmationView orderNumber="BW-0001" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("No pudimos procesar tu pago")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /carrito/i })).toHaveAttribute("href", "/carrito");
  });

  it("shows the timeout screen after 15 attempts still pending, and stops polling", async () => {
    getOrderByNumberMock.mockResolvedValue(order({ payment: { provider: "stripe", state: "pending", captureMethod: "automatic" } }));

    render(<OrderConfirmationView orderNumber="BW-0001" />);
    await act(async () => {
      await Promise.resolve();
    });

    for (let i = 0; i < 14; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
    }

    expect(screen.getByText(/sigue procesándose/)).toBeInTheDocument();
    expect(getOrderByNumberMock).toHaveBeenCalledTimes(15);

    getOrderByNumberMock.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(getOrderByNumberMock).not.toHaveBeenCalled();
  });
});
