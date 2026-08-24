import type { AuthUser, OperationalAlerts } from "@bw-bikes/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { usePathnameMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn().mockReturnValue("/admin") }));
vi.mock("next/navigation", () => ({ usePathname: usePathnameMock }));

const { getOperationalAlertsMock } = vi.hoisted(() => ({ getOperationalAlertsMock: vi.fn() }));
vi.mock("@/lib/api/admin-stats", () => ({ getOperationalAlerts: getOperationalAlertsMock }));

const { logoutMock } = vi.hoisted(() => ({ logoutMock: vi.fn() }));
vi.mock("@/lib/auth/logout", () => ({ logout: logoutMock }));

const { TopBar } = await import("./TopBar");
const { MobileNavProvider } = await import("./MobileNavContext");

const USER: AuthUser = {
  id: "admin-1",
  email: "admin@bnwbikes.com",
  firstName: "Manuel",
  lastName: "Arteaga",
  role: "admin",
  emailVerified: true,
  twoFactorEnabled: true,
  createdAt: new Date().toISOString(),
};

const ZERO_ALERTS: OperationalAlerts = {
  newOrders: 0,
  awaitingSupplierConfirmation: 0,
  expiringAuthorizations: 0,
  staleUnpaidOrders: 0,
  pendingApplications: 0,
  outOfStockSkus: 0,
};

function renderTopBar() {
  return render(
    <MobileNavProvider>
      <TopBar user={USER} />
    </MobileNavProvider>,
  );
}

describe("TopBar", () => {
  it("shows no notification badge when every alert count is zero", async () => {
    getOperationalAlertsMock.mockResolvedValue(ZERO_ALERTS);
    renderTopBar();

    await waitFor(() => expect(getOperationalAlertsMock).toHaveBeenCalled());
    expect(screen.queryByText(/\d/, { selector: "[aria-hidden='true']" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notificaciones" })).toBeInTheDocument();
  });

  it("shows the total pending count as a badge, excluding pendingApplications (not a sale)", async () => {
    getOperationalAlertsMock.mockResolvedValue({ ...ZERO_ALERTS, outOfStockSkus: 2, newOrders: 3, pendingApplications: 99 });
    renderTopBar();

    await screen.findByRole("button", { name: "Notificaciones: 5 pendientes" });
  });

  it("opens a popover with the pending categories, never Solicitudes, and closes on selection", async () => {
    getOperationalAlertsMock.mockResolvedValue({ ...ZERO_ALERTS, outOfStockSkus: 2, pendingApplications: 3 });
    const user = userEvent.setup();
    renderTopBar();

    await user.click(await screen.findByRole("button", { name: "Notificaciones: 2 pendientes" }));

    expect(screen.getByRole("link", { name: /Stock agotado/ })).toBeInTheDocument();
    expect(screen.queryByText("Solicitudes pendientes")).not.toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /Stock agotado/ }));
    expect(screen.queryByRole("link", { name: /Stock agotado/ })).not.toBeInTheDocument();
  });

  it("shows the user's initials on the account menu trigger", async () => {
    getOperationalAlertsMock.mockResolvedValue(ZERO_ALERTS);
    renderTopBar();

    expect(await screen.findByText("MA")).toBeInTheDocument();
  });

  it("shows the user's name, email and role when the account menu opens, and logs out on click", async () => {
    getOperationalAlertsMock.mockResolvedValue(ZERO_ALERTS);
    const user = userEvent.setup();
    renderTopBar();

    await user.click(await screen.findByRole("button", { name: "Cuenta" }));

    expect(screen.getByText("Manuel Arteaga")).toBeInTheDocument();
    expect(screen.getByText("admin@bnwbikes.com")).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Cerrar sesión" }));
    expect(logoutMock).toHaveBeenCalledOnce();
  });
});
