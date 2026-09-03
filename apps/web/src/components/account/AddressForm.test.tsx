import type { SavedAddress } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAccountAddressMock, updateAccountAddressMock } = vi.hoisted(() => ({
  createAccountAddressMock: vi.fn(),
  updateAccountAddressMock: vi.fn(),
}));
vi.mock("@/lib/api/account", () => ({
  createAccountAddress: createAccountAddressMock,
  updateAccountAddress: updateAccountAddressMock,
}));

const { AddressForm } = await import("./AddressForm");

const EXISTING: SavedAddress = {
  id: "addr-1",
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

describe("AddressForm", () => {
  beforeEach(() => {
    createAccountAddressMock.mockReset();
    updateAccountAddressMock.mockReset();
  });

  it("blocks submission when required fields are empty", async () => {
    const user = userEvent.setup();
    render(<AddressForm onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("El nombre de la dirección es obligatorio.")).toBeInTheDocument();
    expect(createAccountAddressMock).not.toHaveBeenCalled();
  });

  it("creates a new address with the filled fields", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();
    const saved: SavedAddress[] = [{ ...EXISTING, id: "addr-new" }];
    createAccountAddressMock.mockResolvedValue(saved);

    render(<AddressForm onClose={onClose} onSaved={onSaved} />);

    await user.type(screen.getByLabelText("Nombre de la dirección"), "Casa");
    await user.type(screen.getByLabelText("Nombre"), "Ana");
    await user.type(screen.getByLabelText("Apellido"), "Pérez");
    await user.type(screen.getByLabelText("Teléfono"), "5512345678");
    await user.type(screen.getByLabelText("Calle"), "Av. Reforma 123");
    await user.type(screen.getByLabelText("Colonia"), "Juárez");
    await user.type(screen.getByLabelText("Ciudad"), "CDMX");
    await user.type(screen.getByLabelText("Código postal"), "06600");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(createAccountAddressMock).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Casa",
        firstName: "Ana",
        lastName: "Pérez",
        phone: "5512345678",
        postalCode: "06600",
      }),
    );
    expect(onSaved).toHaveBeenCalledWith(saved);
    expect(onClose).toHaveBeenCalled();
  });

  it("prefills the fields when editing and calls updateAccountAddress", async () => {
    const user = userEvent.setup();
    updateAccountAddressMock.mockResolvedValue([EXISTING]);

    render(<AddressForm initial={EXISTING} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByLabelText("Nombre de la dirección")).toHaveValue("Casa");
    expect(screen.getByLabelText("Nombre")).toHaveValue("Ana");
    expect(screen.getByLabelText("Apellido")).toHaveValue("Pérez");

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(updateAccountAddressMock).toHaveBeenCalledWith("addr-1", expect.objectContaining({ label: "Casa" }));
  });
});
