import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { changeAccountPasswordMock } = vi.hoisted(() => ({ changeAccountPasswordMock: vi.fn() }));
vi.mock("@/lib/api/account", () => ({ changeAccountPassword: changeAccountPasswordMock }));

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const { PasswordForm } = await import("./PasswordForm");

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  { current, next, confirm }: { current: string; next: string; confirm: string },
) {
  await user.type(screen.getByLabelText("Contraseña actual"), current);
  await user.type(screen.getByLabelText("Nueva contraseña"), next);
  await user.type(screen.getByLabelText("Confirmar nueva contraseña"), confirm);
  await user.click(screen.getByRole("button", { name: "Guardar" }));
}

describe("PasswordForm", () => {
  beforeEach(() => {
    changeAccountPasswordMock.mockReset();
    toastMock.mockReset();
  });

  it("blocks submission when the confirmation doesn't match", async () => {
    const user = userEvent.setup();
    render(<PasswordForm onClose={vi.fn()} />);

    await fillAndSubmit(user, { current: "Old-Password-1", next: "New-Password-2", confirm: "Different-1" });

    expect(await screen.findByText("Las contraseñas no coinciden.")).toBeInTheDocument();
    expect(changeAccountPasswordMock).not.toHaveBeenCalled();
  });

  it("shows an incorrect-current-password error from the API", async () => {
    const { ApiError } = await import("@/lib/api/error");
    changeAccountPasswordMock.mockRejectedValue(new ApiError("La contraseña actual es incorrecta.", 401));
    const user = userEvent.setup();
    render(<PasswordForm onClose={vi.fn()} />);

    await fillAndSubmit(user, { current: "Wrong-Password-1", next: "New-Password-2", confirm: "New-Password-2" });

    expect(await screen.findByText("La contraseña actual es incorrecta.")).toBeInTheDocument();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("changes the password, toasts, and closes on success", async () => {
    changeAccountPasswordMock.mockResolvedValue(undefined);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<PasswordForm onClose={onClose} />);

    await fillAndSubmit(user, { current: "Old-Password-1", next: "New-Password-2", confirm: "New-Password-2" });

    expect(changeAccountPasswordMock).toHaveBeenCalledWith("Old-Password-1", "New-Password-2");
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", title: "Contraseña actualizada. Cerramos tus otras sesiones." }),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
