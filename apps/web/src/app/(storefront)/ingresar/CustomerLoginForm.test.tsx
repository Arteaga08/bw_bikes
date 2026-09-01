import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetchMock, replaceMock, searchParamsGetMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  replaceMock: vi.fn(),
  searchParamsGetMock: vi.fn((_key: string): string | null => null),
}));

vi.mock("@/lib/api/client", () => ({ apiFetch: apiFetchMock }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => ({ get: searchParamsGetMock }),
}));

const { CustomerLoginForm } = await import("./CustomerLoginForm");

async function fillCredentials(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Correo"), "cliente@example.com");
  await user.type(screen.getByLabelText("Contraseña"), "supersecreta");
  await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));
}

describe("CustomerLoginForm", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    replaceMock.mockReset();
    searchParamsGetMock.mockReset();
    searchParamsGetMock.mockReturnValue(null);
  });

  it("logs in and redirects to home when there is no ?redirect=", async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValue({ data: { user: { role: "customer" } } });

    render(<CustomerLoginForm />);
    await fillCredentials(user);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
  });

  it("redirects to a safe ?redirect= target on success", async () => {
    const user = userEvent.setup();
    searchParamsGetMock.mockImplementation((key: string) => (key === "redirect" ? "/mi-cuenta" : null));
    apiFetchMock.mockResolvedValue({ data: { user: { role: "customer" } } });

    render(<CustomerLoginForm />);
    await fillCredentials(user);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/mi-cuenta"));
  });

  it("ignores an unsafe ?redirect= target and falls back to home", async () => {
    const user = userEvent.setup();
    searchParamsGetMock.mockImplementation((key: string) => (key === "redirect" ? "//evil.com" : null));
    apiFetchMock.mockResolvedValue({ data: { user: { role: "customer" } } });

    render(<CustomerLoginForm />);
    await fillCredentials(user);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
  });

  it("shows the reset-password notice when ?restablecida=1 is present", () => {
    searchParamsGetMock.mockImplementation((key: string) => (key === "restablecida" ? "1" : null));

    render(<CustomerLoginForm />);

    expect(screen.getByText("Contraseña actualizada. Ya puedes iniciar sesión.")).toBeInTheDocument();
  });

  it("surfaces the backend's error message without navigating on invalid credentials", async () => {
    const user = userEvent.setup();
    const { ApiError } = await import("@/lib/api/error");
    apiFetchMock.mockRejectedValue(new ApiError("Credenciales inválidas.", 401));

    render(<CustomerLoginForm />);
    await fillCredentials(user);

    expect(await screen.findByText("Credenciales inválidas.")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("shows a 'Reenviar correo' button on a 403 for an unverified account, and resends on click", async () => {
    const user = userEvent.setup();
    const { ApiError } = await import("@/lib/api/error");
    apiFetchMock
      .mockRejectedValueOnce(new ApiError("Verifica tu correo antes de iniciar sesión.", 403))
      .mockResolvedValueOnce({ data: null });

    render(<CustomerLoginForm />);
    await fillCredentials(user);

    const resendButton = await screen.findByRole("button", { name: "Reenviar correo" });
    await user.click(resendButton);

    expect(await screen.findByText(/te enviamos un enlace de verificación/i)).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/auth/resend-verification",
      expect.objectContaining({ method: "POST" }),
      { unauthorizedRedirectPath: null },
    );
  });
});
