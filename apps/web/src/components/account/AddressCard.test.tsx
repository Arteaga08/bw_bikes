import type { SavedAddress } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddressCard } from "./AddressCard";

const ADDRESS: SavedAddress = {
  id: "addr-1",
  label: "Casa",
  isDefault: false,
  recipientName: "Ana Pérez",
  phone: "5512345678",
  street: "Av. Reforma 123",
  neighborhood: "Juárez",
  city: "CDMX",
  state: "Ciudad de México",
  postalCode: "06600",
  country: "MX",
};

describe("AddressCard", () => {
  it("renders the address details", () => {
    render(<AddressCard address={ADDRESS} onEdit={vi.fn()} onDelete={vi.fn()} onSetDefault={vi.fn()} />);

    expect(screen.getByText("Casa")).toBeInTheDocument();
    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByText(/Juárez/)).toBeInTheDocument();
    expect(screen.getByText(/06600/)).toBeInTheDocument();
  });

  it("shows the default badge and hides the set-default action when it is the default", () => {
    render(<AddressCard address={{ ...ADDRESS, isDefault: true }} onEdit={vi.fn()} onDelete={vi.fn()} onSetDefault={vi.fn()} />);

    expect(screen.getByText("Predeterminada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar como predeterminada" })).not.toBeInTheDocument();
  });

  it("shows the set-default action and no badge when it is not the default", () => {
    render(<AddressCard address={ADDRESS} onEdit={vi.fn()} onDelete={vi.fn()} onSetDefault={vi.fn()} />);

    expect(screen.queryByText("Predeterminada")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar como predeterminada" })).toBeInTheDocument();
  });

  it("calls the edit, delete and set-default callbacks", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onSetDefault = vi.fn();
    render(<AddressCard address={ADDRESS} onEdit={onEdit} onDelete={onDelete} onSetDefault={onSetDefault} />);

    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    await user.click(screen.getByRole("button", { name: "Marcar como predeterminada" }));

    expect(onEdit).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
    expect(onSetDefault).toHaveBeenCalled();
  });
});
