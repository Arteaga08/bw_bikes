import type { AccountDTO } from "@bw-bikes/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateAccountProfileMock } = vi.hoisted(() => ({ updateAccountProfileMock: vi.fn() }));

vi.mock("@/lib/api/account", () => ({ updateAccountProfile: updateAccountProfileMock }));

const { ContactCard } = await import("./ContactCard");

const ACCOUNT: AccountDTO = {
  firstName: "Ana",
  lastName: "Pérez",
  email: "ana@example.com",
  phone: "5512345678",
  addresses: [],
  wishlistCount: 0,
};

describe("ContactCard", () => {
  beforeEach(() => {
    updateAccountProfileMock.mockReset();
  });

  it("renders the collapsed summary with an Editar button when !open", () => {
    render(<ContactCard account={ACCOUNT} onAccountChange={vi.fn()} open={false} onEdit={vi.fn()} onDone={vi.fn()} />);

    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });

  it("Editar in the collapsed summary calls onEdit", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<ContactCard account={ACCOUNT} onAccountChange={vi.fn()} open={false} onEdit={onEdit} onDone={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Editar" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("renders the editable form when open, prefilled from the account", () => {
    render(<ContactCard account={ACCOUNT} onAccountChange={vi.fn()} open onEdit={vi.fn()} onDone={vi.fn()} />);

    expect(screen.getByLabelText("Nombre")).toHaveValue("Ana");
    expect(screen.getByLabelText("Apellido")).toHaveValue("Pérez");
    expect(screen.getByLabelText("Teléfono")).toHaveValue("5512345678");
    expect(screen.getByLabelText("Correo electrónico")).toBeDisabled();
  });

  it("saving valid contact info updates the account and calls onDone, not a local mode switch", async () => {
    const updated: AccountDTO = { ...ACCOUNT, firstName: "Ana María" };
    updateAccountProfileMock.mockResolvedValue(updated);
    const onAccountChange = vi.fn();
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<ContactCard account={ACCOUNT} onAccountChange={onAccountChange} open onEdit={vi.fn()} onDone={onDone} />);

    await user.click(screen.getByRole("button", { name: "Continuar a envío" }));

    await waitFor(() => expect(updateAccountProfileMock).toHaveBeenCalledTimes(1));
    expect(onAccountChange).toHaveBeenCalledWith(updated);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("keeps Continuar a envío disabled while the phone is invalid, and never calls onDone", () => {
    const onDone = vi.fn();
    render(
      <ContactCard
        account={{ ...ACCOUNT, phone: "" }}
        onAccountChange={vi.fn()}
        open
        onEdit={vi.fn()}
        onDone={onDone}
      />,
    );

    expect(screen.getByRole("button", { name: "Continuar a envío" })).toBeDisabled();
    expect(updateAccountProfileMock).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});
