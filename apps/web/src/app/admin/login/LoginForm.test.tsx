import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetchMock, replaceMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({ apiFetch: apiFetchMock }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: replaceMock }) }));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,fake") } }));

const { LoginForm } = await import("./LoginForm");

async function fillCredentials(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Correo"), "admin@example.com");
  await user.type(screen.getByLabelText("Contraseña"), "supersecreta");
  await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));
}

describe("LoginForm", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    replaceMock.mockReset();
  });

  it("navigates straight to the panel when the account doesn't require 2FA", async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValue({ data: { user: { role: "customer" } } });

    render(<LoginForm />);
    await fillCredentials(user);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/admin"));
  });

  it("shows the TOTP field — never the panel — when the admin is already enrolled", async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValue({ data: { twoFactorRequired: true, enrolled: true } });

    render(<LoginForm />);
    await fillCredentials(user);

    expect(await screen.findByLabelText("Código de verificación")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("shows the QR and manual secret when the admin isn't enrolled yet", async () => {
    const user = userEvent.setup();
    apiFetchMock
      .mockResolvedValueOnce({ data: { twoFactorRequired: true, enrolled: false } })
      .mockResolvedValueOnce({ data: { secret: "BASE32SECRET", otpauthUrl: "otpauth://totp/x" } });

    render(<LoginForm />);
    await fillCredentials(user);

    expect(await screen.findByText(/BASE32SECRET/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /código qr/i })).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("surfaces the backend's error message without navigating on invalid credentials", async () => {
    const user = userEvent.setup();
    const { ApiError } = await import("@/lib/api/error");
    apiFetchMock.mockRejectedValue(new ApiError("Credenciales inválidas.", 401));

    render(<LoginForm />);
    await fillCredentials(user);

    expect(await screen.findByText("Credenciales inválidas.")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
