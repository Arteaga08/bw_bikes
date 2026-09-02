import type { SavedAddress } from "@bw-bikes/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAccountAddressMock, setDefaultAccountAddressMock, setShippingAddressMock, useCartMock } = vi.hoisted(() => ({
  createAccountAddressMock: vi.fn(),
  setDefaultAccountAddressMock: vi.fn(),
  setShippingAddressMock: vi.fn(),
  useCartMock: vi.fn(),
}));

vi.mock("@/lib/api/account", () => ({
  createAccountAddress: createAccountAddressMock,
  setDefaultAccountAddress: setDefaultAccountAddressMock,
}));
vi.mock("@/components/cart/CartProvider", () => ({ useCart: useCartMock }));

const { ShippingAddressCard } = await import("./ShippingAddressCard");

const DEFAULT_ADDRESS: SavedAddress = {
  id: "addr-default",
  label: "Casa",
  isDefault: true,
  recipientName: "Ana Pérez",
  phone: "5512345678",
  street: "Av. Reforma 123",
  neighborhood: "Juárez",
  city: "CDMX",
  state: "Ciudad de México",
  postalCode: "06600",
  country: "MX",
};

const SECOND_ADDRESS: SavedAddress = { ...DEFAULT_ADDRESS, id: "addr-second", isDefault: false, label: "Oficina" };

const PROFILE = { firstName: "Ana", lastName: "Pérez", phone: "5512345678" };

function setup(cart: { shippingAddress?: unknown } | null = null) {
  useCartMock.mockReturnValue({
    cart,
    setShippingAddress: setShippingAddressMock,
  });
}

describe("ShippingAddressCard", () => {
  beforeEach(() => {
    createAccountAddressMock.mockReset();
    setDefaultAccountAddressMock.mockReset();
    setShippingAddressMock.mockReset().mockResolvedValue(undefined);
  });

  it("shows the address form directly when the book is empty", () => {
    setup();
    render(<ShippingAddressCard addresses={[]} onAddressesChange={vi.fn()} profile={PROFILE} />);
    expect(screen.getByLabelText("Nombre de quien recibe")).toHaveValue("Ana Pérez");
    expect(screen.queryByLabelText("Nombre de la dirección")).not.toBeInTheDocument();
  });

  it("pre-selects the default address when the book has entries", () => {
    setup();
    render(
      <ShippingAddressCard addresses={[DEFAULT_ADDRESS, SECOND_ADDRESS]} onAddressesChange={vi.fn()} profile={PROFILE} />,
    );
    expect(screen.getByRole("radio", { name: /Casa/ })).toBeChecked();
  });

  it("confirming the pre-selected default only PUTs the cart — no promote-to-default call", async () => {
    setup();
    const user = userEvent.setup();
    render(
      <ShippingAddressCard addresses={[DEFAULT_ADDRESS, SECOND_ADDRESS]} onAddressesChange={vi.fn()} profile={PROFILE} />,
    );

    await user.click(screen.getByRole("button", { name: "Usar esta dirección" }));

    await waitFor(() => expect(setShippingAddressMock).toHaveBeenCalled());
    expect(setDefaultAccountAddressMock).not.toHaveBeenCalled();
    expect(setShippingAddressMock).toHaveBeenCalledWith(expect.objectContaining({ street: "Av. Reforma 123" }));
  });

  it("choosing a non-default address promotes it to default, then PUTs the cart", async () => {
    setup();
    setDefaultAccountAddressMock.mockResolvedValue([
      { ...DEFAULT_ADDRESS, isDefault: false },
      { ...SECOND_ADDRESS, isDefault: true },
    ]);
    const onAddressesChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ShippingAddressCard
        addresses={[DEFAULT_ADDRESS, SECOND_ADDRESS]}
        onAddressesChange={onAddressesChange}
        profile={PROFILE}
      />,
    );

    await user.click(screen.getByRole("radio", { name: /Oficina/ }));
    await user.click(screen.getByRole("button", { name: "Usar esta dirección" }));

    await waitFor(() => expect(setShippingAddressMock).toHaveBeenCalled());
    expect(setDefaultAccountAddressMock).toHaveBeenCalledWith("addr-second");
    expect(onAddressesChange).toHaveBeenCalled();
  });

  it("adding a new address creates it, promotes it if needed, then PUTs the cart, in that order", async () => {
    setup();
    createAccountAddressMock.mockResolvedValue([DEFAULT_ADDRESS, { ...SECOND_ADDRESS, id: "addr-new", isDefault: false }]);
    setDefaultAccountAddressMock.mockResolvedValue([
      { ...DEFAULT_ADDRESS, isDefault: false },
      { ...SECOND_ADDRESS, id: "addr-new", isDefault: true },
    ]);
    const onAddressesChange = vi.fn();
    const user = userEvent.setup();
    render(<ShippingAddressCard addresses={[DEFAULT_ADDRESS]} onAddressesChange={onAddressesChange} profile={PROFILE} />);

    await user.click(screen.getByRole("button", { name: "Agregar dirección" }));
    await user.clear(screen.getByLabelText("Nombre de quien recibe"));
    await user.type(screen.getByLabelText("Nombre de quien recibe"), "Otro Nombre");
    await user.clear(screen.getByLabelText("Teléfono"));
    await user.type(screen.getByLabelText("Teléfono"), "5500000000");
    await user.type(screen.getByLabelText("Calle"), "Otra calle 45");
    await user.type(screen.getByLabelText("Colonia"), "Otra colonia");
    await user.type(screen.getByLabelText("Ciudad"), "CDMX");
    await user.type(screen.getByLabelText("Código postal"), "01000");
    await user.click(screen.getByRole("button", { name: "Guardar dirección" }));

    await waitFor(() => expect(setShippingAddressMock).toHaveBeenCalled());

    const createOrder = createAccountAddressMock.mock.invocationCallOrder[0]!;
    const defaultOrder = setDefaultAccountAddressMock.mock.invocationCallOrder[0]!;
    const putOrder = setShippingAddressMock.mock.invocationCallOrder[0]!;
    expect(createOrder).toBeLessThan(defaultOrder);
    expect(defaultOrder).toBeLessThan(putOrder);

    expect(createAccountAddressMock).toHaveBeenCalledWith(expect.objectContaining({ label: "Otra calle 45" }));
  });

  it("still PUTs the cart when the address book is full (409), with a discreet notice", async () => {
    setup();
    const { ApiError } = await import("@/lib/api/error");
    createAccountAddressMock.mockRejectedValue(new ApiError("No puedes guardar más de 5 direcciones.", 409));
    const user = userEvent.setup();
    render(<ShippingAddressCard addresses={[DEFAULT_ADDRESS]} onAddressesChange={vi.fn()} profile={PROFILE} />);

    await user.click(screen.getByRole("button", { name: "Agregar dirección" }));
    await user.clear(screen.getByLabelText("Nombre de quien recibe"));
    await user.type(screen.getByLabelText("Nombre de quien recibe"), "Otro Nombre");
    await user.clear(screen.getByLabelText("Teléfono"));
    await user.type(screen.getByLabelText("Teléfono"), "5500000000");
    await user.type(screen.getByLabelText("Calle"), "Otra calle 45");
    await user.type(screen.getByLabelText("Colonia"), "Otra colonia");
    await user.type(screen.getByLabelText("Ciudad"), "CDMX");
    await user.type(screen.getByLabelText("Código postal"), "01000");
    await user.click(screen.getByRole("button", { name: "Guardar dirección" }));

    await waitFor(() => expect(setShippingAddressMock).toHaveBeenCalled());
    expect(screen.getByText(/libreta está llena/)).toBeInTheDocument();
  });
});
