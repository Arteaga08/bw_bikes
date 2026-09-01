import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));

vi.mock("@/lib/api/client", () => ({ apiFetch: apiFetchMock }));

const { ForgotPasswordForm } = await import("./ForgotPasswordForm");

async function submit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Correo"), "cliente@example.com");
  await user.click(screen.getByRole("button", { name: "Enviar" }));
}

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("shows the generic acknowledgment message when the account exists", async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValue({ data: null });

    render(<ForgotPasswordForm />);
    await submit(user);

    expect(await screen.findByText("Si el correo existe, te enviamos un enlace.")).toBeInTheDocument();
  });

  it("shows the same generic message even when the request itself fails", async () => {
    const user = userEvent.setup();
    const { ApiError } = await import("@/lib/api/error");
    apiFetchMock.mockRejectedValue(new ApiError("Error inesperado.", 400));

    render(<ForgotPasswordForm />);
    await submit(user);

    expect(await screen.findByText("Si el correo existe, te enviamos un enlace.")).toBeInTheDocument();
  });
});
