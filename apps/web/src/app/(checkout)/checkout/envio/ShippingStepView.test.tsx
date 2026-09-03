import type { AccountDTO } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { useCartMock } = vi.hoisted(() => ({ useCartMock: vi.fn() }));

vi.mock("@/components/cart/CartProvider", () => ({ useCart: useCartMock }));
vi.mock("@/components/checkout/CheckoutGuard", () => ({
  CheckoutGuard: ({ steps, summary }: { steps: React.ReactNode; summary: React.ReactNode }) => (
    <>
      {steps}
      {summary}
    </>
  ),
}));
vi.mock("@/components/checkout/CheckoutSummary", () => ({ CheckoutSummary: () => <div data-testid="summary" /> }));
vi.mock("@/components/checkout/ContactCard", () => ({
  ContactCard: ({ open, onEdit, onDone }: { open: boolean; onEdit: () => void; onDone: () => void }) => (
    <div data-testid="contacto" data-open={open}>
      <button onClick={onEdit}>editar-contacto</button>
      <button onClick={onDone}>done-contacto</button>
    </div>
  ),
}));
vi.mock("@/components/checkout/ShippingAddressCard", () => ({
  ShippingAddressCard: ({
    open,
    locked,
    onEdit,
    onDone,
  }: {
    open: boolean;
    locked: boolean;
    onEdit: () => void;
    onDone: () => void;
  }) => (
    <div data-testid="envio" data-open={open} data-locked={locked}>
      <button onClick={onEdit}>editar-envio</button>
      <button onClick={onDone}>done-envio</button>
    </div>
  ),
}));
vi.mock("@/components/checkout/PaymentCard", () => ({
  PaymentCard: ({ open }: { open: boolean }) => <div data-testid="pago" data-open={open} />,
}));

const { ShippingStepView } = await import("./ShippingStepView");

const INCOMPLETE_ACCOUNT: AccountDTO = {
  firstName: "",
  lastName: "",
  email: "ana@example.com",
  phone: undefined,
  addresses: [],
  wishlistCount: 0,
};

const COMPLETE_ACCOUNT: AccountDTO = {
  firstName: "Ana",
  lastName: "Pérez",
  email: "ana@example.com",
  phone: "5512345678",
  addresses: [],
  wishlistCount: 0,
};

const SHIPPING_ADDRESS = {
  firstName: "Ana",
  lastName: "Pérez",
  phone: "5512345678",
  street: "Av. Reforma 123",
  neighborhood: "Juárez",
  city: "CDMX",
  state: "Ciudad de México",
  postalCode: "06600",
  country: "MX",
};

function attrOpen(testId: string): string | null {
  return screen.getByTestId(testId).getAttribute("data-open");
}

describe("ShippingStepView", () => {
  it("opens only Contacto when the account has no contact info yet, and locks Envío", () => {
    useCartMock.mockReturnValue({ cart: null });
    render(<ShippingStepView account={INCOMPLETE_ACCOUNT} cloudName="demo" />);

    expect(attrOpen("contacto")).toBe("true");
    expect(attrOpen("envio")).toBe("false");
    expect(screen.getByTestId("envio")).toHaveAttribute("data-locked", "true");
    expect(attrOpen("pago")).toBe("false");
  });

  it("opens Envío once the account is complete but the cart has no shipping address yet", () => {
    useCartMock.mockReturnValue({ cart: { shippingAddress: undefined } });
    render(<ShippingStepView account={COMPLETE_ACCOUNT} cloudName="demo" />);

    expect(attrOpen("contacto")).toBe("false");
    expect(attrOpen("envio")).toBe("true");
    expect(screen.getByTestId("envio")).toHaveAttribute("data-locked", "false");
    expect(attrOpen("pago")).toBe("false");
  });

  it("opens Pago once both Contacto and Envío are done", () => {
    useCartMock.mockReturnValue({ cart: { shippingAddress: SHIPPING_ADDRESS } });
    render(<ShippingStepView account={COMPLETE_ACCOUNT} cloudName="demo" />);

    expect(attrOpen("contacto")).toBe("false");
    expect(attrOpen("envio")).toBe("false");
    expect(attrOpen("pago")).toBe("true");
  });

  it("confirming Contacto advances the accordion to Envío", async () => {
    useCartMock.mockReturnValue({ cart: { shippingAddress: undefined } });
    const user = userEvent.setup();
    render(<ShippingStepView account={INCOMPLETE_ACCOUNT} cloudName="demo" />);

    await user.click(screen.getByText("done-contacto"));

    expect(attrOpen("contacto")).toBe("false");
    expect(attrOpen("envio")).toBe("true");
  });

  it("confirming Envío advances the accordion to Pago", async () => {
    useCartMock.mockReturnValue({ cart: { shippingAddress: SHIPPING_ADDRESS } });
    const user = userEvent.setup();
    render(<ShippingStepView account={COMPLETE_ACCOUNT} cloudName="demo" />);

    // Both steps already look done from data alone; open Envío explicitly
    // first, the way pressing "Editar" would, then confirm it.
    await user.click(screen.getByText("editar-envio"));
    expect(attrOpen("envio")).toBe("true");

    await user.click(screen.getByText("done-envio"));

    expect(attrOpen("envio")).toBe("false");
    expect(attrOpen("pago")).toBe("true");
  });

  it("Editar on Contacto re-opens it and closes every other step, even mid-checkout", async () => {
    useCartMock.mockReturnValue({ cart: { shippingAddress: SHIPPING_ADDRESS } });
    const user = userEvent.setup();
    render(<ShippingStepView account={COMPLETE_ACCOUNT} cloudName="demo" />);

    expect(attrOpen("pago")).toBe("true");

    await user.click(screen.getByText("editar-contacto"));

    expect(attrOpen("contacto")).toBe("true");
    expect(attrOpen("envio")).toBe("false");
    expect(attrOpen("pago")).toBe("false");
  });
});
