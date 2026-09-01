import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { usePathnameMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: usePathnameMock }));

const { logoutMock } = vi.hoisted(() => ({ logoutMock: vi.fn() }));
vi.mock("@/lib/auth/logout", () => ({ logout: logoutMock }));

const { AccountSidebar } = await import("./AccountSidebar");

const USER = { firstName: "Ana", lastName: "Pérez" };

function renderAt(pathname: string) {
  usePathnameMock.mockReturnValue(pathname);
  return render(<AccountSidebar user={USER} />);
}

describe("AccountSidebar", () => {
  it("shows the customer's full name", () => {
    renderAt("/mi-cuenta/perfil");
    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
  });

  it("marks Perfil current on its own route", () => {
    renderAt("/mi-cuenta/perfil");
    expect(screen.getByRole("link", { name: /Perfil/ })).toHaveAttribute("aria-current", "page");
  });

  it("marks a sub-route's nav item current by prefix, not Perfil", () => {
    renderAt("/mi-cuenta/direcciones");
    expect(screen.getByRole("link", { name: /Libreta de Direcciones/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Perfil/ })).not.toHaveAttribute("aria-current");
  });

  it("logs the customer out when 'Cerrar sesión' is clicked", async () => {
    const user = userEvent.setup();
    renderAt("/mi-cuenta/perfil");

    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    expect(logoutMock).toHaveBeenCalled();
  });
});
