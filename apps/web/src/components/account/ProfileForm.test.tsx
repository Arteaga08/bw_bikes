import type { AccountDTO } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateAccountProfileMock } = vi.hoisted(() => ({ updateAccountProfileMock: vi.fn() }));
vi.mock("@/lib/api/account", () => ({ updateAccountProfile: updateAccountProfileMock }));

const { ProfileForm } = await import("./ProfileForm");

const INITIAL: AccountDTO = {
  firstName: "Ana",
  lastName: "Pérez",
  email: "ana@example.com",
  phone: "5512345678",
  birthDate: "1990-05-10T00:00:00.000Z",
  city: "CDMX",
};

describe("ProfileForm", () => {
  beforeEach(() => {
    updateAccountProfileMock.mockReset();
  });

  it("prefills the fields from the initial account", () => {
    render(<ProfileForm initial={INITIAL} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByLabelText("Nombre")).toHaveValue("Ana");
    expect(screen.getByLabelText("Apellido")).toHaveValue("Pérez");
    expect(screen.getByLabelText("Teléfono")).toHaveValue("5512345678");
    expect(screen.getByLabelText("Ciudad")).toHaveValue("CDMX");
    expect(screen.getByLabelText("Cumpleaños")).toHaveValue("1990-05-10");
  });

  it("blocks submission when the name fields are cleared", async () => {
    const user = userEvent.setup();
    render(<ProfileForm initial={INITIAL} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.clear(screen.getByLabelText("Nombre"));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("El nombre es obligatorio.")).toBeInTheDocument();
    expect(updateAccountProfileMock).not.toHaveBeenCalled();
  });

  it("saves the updated profile and calls onSaved + onClose", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();
    const updated = { ...INITIAL, city: "Guadalajara" };
    updateAccountProfileMock.mockResolvedValue(updated);

    render(<ProfileForm initial={INITIAL} onClose={onClose} onSaved={onSaved} />);

    await user.clear(screen.getByLabelText("Ciudad"));
    await user.type(screen.getByLabelText("Ciudad"), "Guadalajara");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(updateAccountProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: "Ana", lastName: "Pérez", city: "Guadalajara" }),
    );
    expect(onSaved).toHaveBeenCalledWith(updated);
    expect(onClose).toHaveBeenCalled();
  });
});
