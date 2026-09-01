import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ACCOUNT_NAV_ITEMS } from "./nav-items";

const { logoutMock } = vi.hoisted(() => ({ logoutMock: vi.fn() }));
vi.mock("@/lib/auth/logout", () => ({ logout: logoutMock }));

const { AccountHub } = await import("./AccountHub");

const USER = { firstName: "Ana", lastName: "Pérez" };

describe("AccountHub", () => {
  it("shows the customer's full name", () => {
    render(<AccountHub user={USER} />);
    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
  });

  it("renders one tile per account nav item, linking to its section", () => {
    render(<AccountHub user={USER} />);

    for (const item of ACCOUNT_NAV_ITEMS) {
      expect(screen.getByRole("link", { name: item.label })).toHaveAttribute("href", item.href);
    }
  });

  it("logs the customer out when 'Cerrar sesión' is clicked", async () => {
    const user = userEvent.setup();
    render(<AccountHub user={USER} />);

    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    expect(logoutMock).toHaveBeenCalled();
  });
});
