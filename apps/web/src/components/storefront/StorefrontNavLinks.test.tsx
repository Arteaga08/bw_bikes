import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { usePathnameMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: usePathnameMock }));

const { StorefrontNavLinks } = await import("./StorefrontNavLinks");

function renderAt(pathname: string) {
  usePathnameMock.mockReturnValue(pathname);
  return render(<StorefrontNavLinks tone="neutral" />);
}

describe("StorefrontNavLinks", () => {
  it("renders the three public destinations as links to their real hrefs", () => {
    renderAt("/");
    expect(screen.getByRole("link", { name: "Bicicletas" })).toHaveAttribute("href", "/bicicletas");
    expect(screen.getByRole("link", { name: "Accesorios" })).toHaveAttribute("href", "/accesorios");
    expect(screen.getByRole("link", { name: "Ofertas" })).toHaveAttribute("href", "/ofertas");
  });

  it("renders each destination as a text-variant ButtonLink (<a>, not <button>), never a hand-styled Link", () => {
    renderAt("/");
    const link = screen.getByRole("link", { name: "Bicicletas" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveClass("group"); // TEXT_CONTROL_CLASSES — proof this is ButtonLink, not a raw <Link>
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("marks the current section current on a sub-route, with the underline pinned open", () => {
    renderAt("/accesorios/casco-mtb");
    const link = screen.getByRole("link", { name: "Accesorios" });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link.querySelector("span[aria-hidden='true']")).toHaveClass("scale-x-100");

    const inactive = screen.getByRole("link", { name: "Bicicletas" });
    expect(inactive).not.toHaveAttribute("aria-current");
    expect(inactive.querySelector("span[aria-hidden='true']")).toHaveClass("scale-x-0");
  });

  it("marks nothing current on the home route", () => {
    renderAt("/");
    for (const label of ["Bicicletas", "Accesorios", "Ofertas"]) {
      expect(screen.getByRole("link", { name: label })).not.toHaveAttribute("aria-current");
    }
  });
});
