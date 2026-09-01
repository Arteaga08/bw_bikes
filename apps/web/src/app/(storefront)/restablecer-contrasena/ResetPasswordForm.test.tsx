import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetchMock, replaceMock, searchParamsGetMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  replaceMock: vi.fn(),
  searchParamsGetMock: vi.fn(() => "a-token"),
}));

vi.mock("@/lib/api/client", () => ({ apiFetch: apiFetchMock }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => ({ get: searchParamsGetMock }),
}));

const { ResetPasswordForm } = await import("./ResetPasswordForm");

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nueva contraseña"), "nuevasecreta");
  await user.type(screen.getByLabelText("Confirmar contraseña"), "nuevasecreta");
  await user.click(screen.getByRole("button", { name: "Restablecer contraseña" }));
}

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    replaceMock.mockReset();
    searchParamsGetMock.mockReset();
    searchParamsGetMock.mockReturnValue("a-token");
  });

  it("sends the token from the URL along with the new password, and redirects to login with a notice on success", async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValue({ data: null });

    render(<ResetPasswordForm />);
    await fillAndSubmit(user);

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/auth/reset-password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "a-token", password: "nuevasecreta", passwordConfirm: "nuevasecreta" }),
      }),
      { unauthorizedRedirectPath: null },
    );
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/ingresar?restablecida=1"));
  });

  it("surfaces the backend's error message without redirecting on an invalid/expired token", async () => {
    const user = userEvent.setup();
    const { ApiError } = await import("@/lib/api/error");
    apiFetchMock.mockRejectedValue(new ApiError("Token de restablecimiento inválido o expirado.", 400));

    render(<ResetPasswordForm />);
    await fillAndSubmit(user);

    expect(await screen.findByText("Token de restablecimiento inválido o expirado.")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
