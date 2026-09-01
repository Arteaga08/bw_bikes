import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { usePathnameMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn(() => "/") }));
vi.mock("next/navigation", () => ({ usePathname: usePathnameMock }));

const { Navbar } = await import("./Navbar");

function renderAt(pathname: string) {
  usePathnameMock.mockReturnValue(pathname);
  return render(<Navbar />);
}

// One test inserts a raw `data-navbar-overlay` marker as a DOM sibling
// (`useNavbarOverlay` looks it up outside React's tree) — RTL's own
// `afterEach(cleanup)` only unmounts React roots, so that stray element
// would otherwise leak into every test after it.
beforeEach(() => {
  document.body.innerHTML = "";
});

describe("Navbar", () => {
  it("renders the wordmark linking home and the three nav destinations in the desktop nav", () => {
    renderAt("/bicicletas");

    // Scoped away from `MobileMenu`'s own header lockup — it links home with
    // the identical accessible name ("Black and White Bikes — inicio"), so an
    // unscoped query would find two. jsdom doesn't compute `inert` for role
    // queries the way a real browser's accessibility tree would, so the
    // drawer copy isn't filtered out for free even while closed.
    const dialog = screen.getByRole("dialog", { hidden: true });
    const wordmarkLinks = screen.getAllByRole("link", { name: /black and white bikes/i });
    const desktopWordmark = wordmarkLinks.find((link) => !dialog.contains(link));
    expect(desktopWordmark).toHaveAttribute("href", "/");

    // Scoped to the desktop `<nav>` — the same three items also exist, closed
    // and `inert`, inside `MobileMenu`'s drawer (CSS-only `md:`/`hidden`
    // toggling between the two, which jsdom doesn't compute), so an
    // unscoped query would find two of each. Each destination is now a
    // mega-menu disclosure button, not a plain link — see StorefrontNavLinks.test.tsx.
    const desktopNav = within(screen.getByRole("navigation", { name: "Navegación principal" }));
    expect(desktopNav.getByRole("button", { name: "Bicicletas" })).toBeInTheDocument();
    expect(desktopNav.getByRole("button", { name: "Accesorios" })).toBeInTheDocument();
    expect(desktopNav.getByRole("button", { name: "Ofertas" })).toBeInTheDocument();
  });

  it("renders Buscar/Carrito as disabled placeholders and Cuenta as a real link to /mi-cuenta — M13 A1", () => {
    renderAt("/bicicletas");
    expect(screen.getByRole("button", { name: "Buscar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /carrito/i })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Cuenta" })).toHaveAttribute("href", "/mi-cuenta");
  });

  it("renders exactly one mobile menu toggle", () => {
    renderAt("/bicicletas");
    expect(screen.getByRole("button", { name: /menú/i })).toBeInTheDocument();
  });

  it("starts transparent over the home route's hero, and skips the layout spacer there", () => {
    usePathnameMock.mockReturnValue("/");
    // `useNavbarOverlay` looks for the marker as a real DOM sibling — in the
    // actual page, `page.tsx`'s hero and `layout.tsx`'s `<Navbar/>` both sit
    // under the same `<body>`, so this mirrors that instead of relying on
    // Navbar to render its own hero (it doesn't; it only reacts to one).
    document.body.insertAdjacentHTML("afterbegin", "<div data-navbar-overlay></div>");
    const { container } = render(<Navbar />);
    const header = container.querySelector("header")!;
    expect(header).toHaveClass("bg-transparent");
    expect(header).not.toHaveClass("bg-surface");
    // No 64px spacer after the header on this route — the hero itself owns
    // that space, starting at y=0 under the transparent bar.
    expect(header.nextElementSibling).toBeNull();
  });

  it("starts solid on a route with no hero, and renders the layout spacer", () => {
    const { container } = renderAt("/bicicletas");
    const header = container.querySelector("header")!;
    expect(header).toHaveClass("bg-surface");
    expect(header).not.toHaveClass("bg-transparent");
    expect(header.nextElementSibling).not.toBeNull();
  });
});
