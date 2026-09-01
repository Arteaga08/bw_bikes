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
  await user.type(screen.getByLabelText("Contraseña"), "Super-Secreta1");
  await user.type(screen.getByLabelText("Confirmar contraseña"), "Super-Secreta1");
  await user.click(screen.getByRole("checkbox", { name: /Acepto los Términos de uso/ }));
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

  it("resends the verification email on click", async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValueOnce({ data: null });

    render(<CustomerRegisterForm />);
    await fillForm(user);
    await screen.findByText(/revisa tu correo para verificar tu cuenta/i);

    apiFetchMock.mockResolvedValueOnce({ data: null });
    await user.click(screen.getByRole("button", { name: "Reenviar correo" }));

    expect(await screen.findByText(/te enviamos un nuevo enlace de verificación/i)).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      "/auth/resend-verification",
      { method: "POST", body: JSON.stringify({ email: "ada@example.com" }) },
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

  it("keeps the submit button disabled until the terms checkbox is checked", async () => {
    const user = userEvent.setup();
    render(<CustomerRegisterForm />);

    const submit = screen.getByRole("button", { name: "Crear cuenta" });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: /Acepto los Términos de uso/ }));
    expect(submit).toBeEnabled();
  });

  it("marks each password requirement as met while the user types a compliant password", async () => {
    const user = userEvent.setup();
    render(<CustomerRegisterForm />);

    await user.type(screen.getByLabelText("Contraseña"), "Super-Secreta1");

    expect(screen.getByText("Fortaleza: Fuerte")).toBeInTheDocument();
  });
});
