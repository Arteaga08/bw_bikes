import type { SavedAddress } from "@bw-bikes/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
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

/**
 * Mirrors what `ShippingStepView` actually does on `onDone` — flips this
 * card from `open` to its collapsed summary. Needed for the one test that
 * checks the collapsed view's `bookFullNotice`, since `ShippingAddressCard`
 * itself no longer owns that transition (see `ShippingStepView`).
 */
function OpenControlledCard(props: {
  addresses: SavedAddress[];
  onAddressesChange: (addresses: SavedAddress[]) => void;
  profile: { firstName: string; lastName: string; phone?: string };
}) {
  const [open, setOpen] = useState(true);
  return <ShippingAddressCard {...props} open={open} locked={false} onEdit={() => setOpen(true)} onDone={() => setOpen(false)} />;
}

const DEFAULT_ADDRESS: SavedAddress = {
  id: "addr-default",
  label: "Casa",
  isDefault: true,
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

  it("shows a locked placeholder and no address fields while Contacto is incomplete", () => {
    setup();
    render(
      <ShippingAddressCard
        addresses={[]}
        onAddressesChange={vi.fn()}
        profile={PROFILE}
        open={false}
        locked
        onEdit={vi.fn()}
        onDone={vi.fn()}
      />,
    );
    expect(screen.getByText("Completa tus datos de contacto para continuar.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Calle")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });

  it("shows the address form directly when the book is empty, without asking for the recipient again", () => {
    setup();
    render(
      <ShippingAddressCard
        addresses={[]}
        onAddressesChange={vi.fn()}
        profile={PROFILE}
        open
        locked={false}
        onEdit={vi.fn()}
        onDone={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Calle")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre de la dirección")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Teléfono")).not.toBeInTheDocument();
    expect(screen.getByLabelText("País")).toHaveValue("México");
  });

  it("pre-selects the default address when the book has entries", () => {
    setup();
    render(
      <ShippingAddressCard
        addresses={[DEFAULT_ADDRESS, SECOND_ADDRESS]}
        onAddressesChange={vi.fn()}
        profile={PROFILE}
        open
        locked={false}
        onEdit={vi.fn()}
        onDone={vi.fn()}
      />,
    );
    expect(screen.getByRole("radio", { name: /Casa/ })).toBeChecked();
  });

  it("confirming the pre-selected default only PUTs the cart — no promote-to-default call — and advances the accordion", async () => {
    setup();
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(
      <ShippingAddressCard
        addresses={[DEFAULT_ADDRESS, SECOND_ADDRESS]}
        onAddressesChange={vi.fn()}
        profile={PROFILE}
        open
        locked={false}
        onEdit={vi.fn()}
        onDone={onDone}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Usar esta dirección" }));

    await waitFor(() => expect(setShippingAddressMock).toHaveBeenCalled());
    expect(setDefaultAccountAddressMock).not.toHaveBeenCalled();
    expect(setShippingAddressMock).toHaveBeenCalledWith(expect.objectContaining({ street: "Av. Reforma 123" }));
    expect(onDone).toHaveBeenCalledTimes(1);
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
        open
        locked={false}
        onEdit={vi.fn()}
        onDone={vi.fn()}
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
    render(
      <ShippingAddressCard
        addresses={[DEFAULT_ADDRESS]}
        onAddressesChange={onAddressesChange}
        profile={PROFILE}
        open
        locked={false}
        onEdit={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Agregar dirección" }));
    await user.type(screen.getByLabelText("Calle"), "Otra calle 45");
    await user.type(screen.getByLabelText("Colonia"), "Otra colonia");
    await user.type(screen.getByLabelText("Ciudad"), "CDMX");
    await user.type(screen.getByLabelText("Código postal"), "01000");
    await user.click(screen.getByRole("button", { name: "Guardar y continuar" }));

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
    render(<OpenControlledCard addresses={[DEFAULT_ADDRESS]} onAddressesChange={vi.fn()} profile={PROFILE} />);

    await user.click(screen.getByRole("button", { name: "Agregar dirección" }));
    await user.type(screen.getByLabelText("Calle"), "Otra calle 45");
    await user.type(screen.getByLabelText("Colonia"), "Otra colonia");
    await user.type(screen.getByLabelText("Ciudad"), "CDMX");
    await user.type(screen.getByLabelText("Código postal"), "01000");
    await user.click(screen.getByRole("button", { name: "Guardar y continuar" }));

    await waitFor(() => expect(setShippingAddressMock).toHaveBeenCalled());
    expect(screen.getByText(/libreta está llena/)).toBeInTheDocument();
  });

  it("collapses to its summary with an Editar button once !open, and reopening returns to Editar", async () => {
    setup({ shippingAddress: DEFAULT_ADDRESS });
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(
      <ShippingAddressCard
        addresses={[DEFAULT_ADDRESS]}
        onAddressesChange={vi.fn()}
        profile={PROFILE}
        open={false}
        locked={false}
        onEdit={onEdit}
        onDone={vi.fn()}
      />,
    );

    expect(screen.getByText("Av. Reforma 123")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
