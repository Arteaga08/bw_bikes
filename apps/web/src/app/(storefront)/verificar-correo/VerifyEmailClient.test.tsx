import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetchMock, searchParamsGetMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  searchParamsGetMock: vi.fn(() => null as string | null),
}));

vi.mock("@/lib/api/client", () => ({ apiFetch: apiFetchMock }));
vi.mock("next/navigation", () => ({ useSearchParams: () => ({ get: searchParamsGetMock }) }));

const { VerifyEmailClient } = await import("./VerifyEmailClient");

describe("VerifyEmailClient", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    searchParamsGetMock.mockReset();
    searchParamsGetMock.mockReturnValue(null);
  });

  it("shows a loading state while the verification request is in flight", () => {
    searchParamsGetMock.mockReturnValue("a-token");
    apiFetchMock.mockReturnValue(new Promise(() => {}));

    render(<VerifyEmailClient />);

    expect(screen.getByText(/verificando tu correo/i)).toBeInTheDocument();
  });

  it("shows the verified state and a link to login on success", async () => {
    searchParamsGetMock.mockReturnValue("a-token");
    apiFetchMock.mockResolvedValue({ data: null });

    render(<VerifyEmailClient />);

    expect(await screen.findByText(/correo verificado/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/ingresar");
  });

  it("shows the error state with a resend form when the token is invalid or expired", async () => {
    searchParamsGetMock.mockReturnValue("a-token");
    const { ApiError } = await import("@/lib/api/error");
    apiFetchMock.mockRejectedValue(new ApiError("Token de verificación inválido o expirado.", 400));

    render(<VerifyEmailClient />);

    expect(await screen.findByText("Token de verificación inválido o expirado.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reenviar correo" })).toBeInTheDocument();
  });

  it("shows the error state immediately when there is no token in the URL", () => {
    searchParamsGetMock.mockReturnValue(null);

    render(<VerifyEmailClient />);

    expect(screen.getByText(/falta el token de verificación/i)).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("resends the verification email from the error state's form", async () => {
    const user = userEvent.setup();
    searchParamsGetMock.mockReturnValue("expired-token");
    const { ApiError } = await import("@/lib/api/error");
    apiFetchMock
      .mockRejectedValueOnce(new ApiError("Token de verificación inválido o expirado.", 400))
      .mockResolvedValueOnce({ data: null });

    render(<VerifyEmailClient />);
    await screen.findByRole("button", { name: "Reenviar correo" });

    await user.type(screen.getByLabelText("Correo"), "cliente@example.com");
    await user.click(screen.getByRole("button", { name: "Reenviar correo" }));

    expect(await screen.findByText(/te enviamos un enlace de verificación/i)).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      "/auth/resend-verification",
      expect.objectContaining({ method: "POST" }),
      { unauthorizedRedirectPath: null },
    );
  });
});
