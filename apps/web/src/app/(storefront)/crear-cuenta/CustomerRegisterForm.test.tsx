import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetchMock, searchParamsGetMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  searchParamsGetMock: vi.fn(() => null),
}));

vi.mock("@/lib/api/client", () => ({ apiFetch: apiFetchMock }));
vi.mock("next/navigation", () => ({ useSearchParams: () => ({ get: searchParamsGetMock }) }));

const { CustomerRegisterForm } = await import("./CustomerRegisterForm");

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nombre"), "Ada");
  await user.type(screen.getByLabelText("Apellido"), "Lovelace");
  await user.type(screen.getByLabelText("Correo"), "ada@example.com");
  await user.type(screen.getByLabelText("Contraseña"), "supersecreta");
  await user.type(screen.getByLabelText("Confirmar contraseña"), "supersecreta");
  await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
}

describe("CustomerRegisterForm", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    searchParamsGetMock.mockReset();
    searchParamsGetMock.mockReturnValue(null);
  });

  it("shows the verification screen after a successful registration", async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValue({ data: null });

    render(<CustomerRegisterForm />);
    await fillForm(user);

    expect(await screen.findByText(/revisa tu correo para verificar tu cuenta/i)).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/auth/register",
      expect.objectContaining({ method: "POST" }),
      { unauthorizedRedirectPath: null },
    );
  });

  it("surfaces the backend's error message without switching to the verification screen", async () => {
    const user = userEvent.setup();
    const { ApiError } = await import("@/lib/api/error");
    apiFetchMock.mockRejectedValue(new ApiError("Esta contraseña ha aparecido en fugas de datos conocidas.", 400));

    render(<CustomerRegisterForm />);
    await fillForm(user);

    expect(await screen.findByText(/ha aparecido en fugas de datos conocidas/i)).toBeInTheDocument();
    expect(screen.queryByText(/revisa tu correo/i)).not.toBeInTheDocument();
  });
});
