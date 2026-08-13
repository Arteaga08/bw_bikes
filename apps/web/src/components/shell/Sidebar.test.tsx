import type { AuthUser } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { usePathnameMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: usePathnameMock }));

const { Sidebar } = await import("./Sidebar");
const { MobileNavProvider } = await import("./MobileNavContext");

const USER: AuthUser = {
  id: "admin-1",
  email: "admin@bnwbikes.com",
  firstName: "Admin",
  lastName: "Admin",
  role: "admin",
  emailVerified: true,
  twoFactorEnabled: true,
  createdAt: new Date().toISOString(),
};

function renderAt(pathname: string) {
  usePathnameMock.mockReturnValue(pathname);
  return render(
    <MobileNavProvider>
      <Sidebar user={USER} />
    </MobileNavProvider>,
  );
}

describe("Sidebar", () => {
  it("marks the catalog's list item current on its create sub-route (prefix match, not equality)", () => {
    renderAt("/admin/catalogo/bicicletas/nueva");
    expect(screen.getByRole("link", { name: "Bicicletas" })).toHaveAttribute("aria-current", "page");
  });

  it("marks the right section's Categorías item, not the sibling product item", () => {
    renderAt("/admin/catalogo/categorias/bicicletas");
    const links = screen.getAllByRole("link", { name: "Categorías" });
    // Two "Categorías" items exist (Bicicletas section, Accesorios section) —
    // exactly the one under the active path should be current.
    const current = links.filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute("href", "/admin/catalogo/categorias/bicicletas");
    expect(screen.getByRole("link", { name: "Bicicletas" })).not.toHaveAttribute("aria-current");
  });

  it("never marks Inicio current outside the exact root route (every admin path starts with /admin)", () => {
    renderAt("/admin/catalogo/bicicletas");
    expect(screen.getByRole("link", { name: "Inicio" })).not.toHaveAttribute("aria-current");
  });
});
