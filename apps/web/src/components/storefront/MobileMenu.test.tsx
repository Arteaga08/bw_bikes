import type { PublicCategoryTreeNode } from "@bw-bikes/shared";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

const { usePathnameMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn(() => "/") }));
vi.mock("next/navigation", () => ({ usePathname: usePathnameMock }));

const { MobileMenu } = await import("./MobileMenu");

// `MobileMenuPanel` is code-split (`next/dynamic`). Under Vitest — no
// prebuilt Next chunks, just Vite transforming the module live — the first
// time any test triggers that `import()` it competes with every other test
// file's own cold module loads for real disk I/O, which can occasionally
// outrun even a generous `findBy` timeout. Warming the chunk once here
// keeps every `findBy` below waiting on a React re-render, not a transform.
beforeAll(async () => {
  await import("./MobileMenuPanel");
});

const BIKE_CATEGORIES: PublicCategoryTreeNode[] = [
  { id: "1", name: "Ruta", slug: "ruta", parent: null, order: 0, usesSizes: true, children: [] },
  { id: "2", name: "Montaña", slug: "montana", parent: null, order: 1, usesSizes: true, children: [] },
];

/**
 * `MobileMenuPanel` is code-split (`next/dynamic`, M-optimización) and only
 * mounts once the toggle is clicked or focused — see `MobileMenu`'s own doc
 * comment for why (its chunk sits behind every public route otherwise). Every
 * test that needs the drawer's contents opens it this way and waits for the
 * panel's dialog to land before asserting on anything inside it.
 */
async function openMenu(): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
  // Generous timeout: under a full parallel test run, `next/dynamic`'s
  // underlying import() competes with every other file's own real disk
  // I/O and transform work, which can occasionally push past RTL's 1000ms
  // default even though it resolves in milliseconds running alone.
  await screen.findByRole("dialog", {}, { timeout: 3000 });
}

describe("MobileMenu", () => {
  it("starts closed, with the drawer inert", async () => {
    render(<MobileMenu tone="neutral" />);
    expect(screen.getByRole("button", { name: "Abrir menú" })).toBeInTheDocument();

    // Focusing the toggle (without clicking it) is enough to trigger the
    // idle-mount escape hatch — the same one a keyboard user tabbing onto the
    // button relies on — without opening the drawer.
    fireEvent.focus(screen.getByRole("button", { name: "Abrir menú" }));
    expect(await screen.findByRole("dialog", { hidden: true }, { timeout: 3000 })).toHaveAttribute("inert", "");
  });

  it("opens on toggle, exposing the three nav links inside the drawer, entering from the left", async () => {
    render(<MobileMenu tone="neutral" />);
    await openMenu();

    expect(screen.getByRole("button", { name: "Cerrar menú" })).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(dialog).not.toHaveAttribute("inert");
    expect(dialog).toHaveClass("left-0");
    expect(dialog).toHaveClass("translate-x-0");
    expect(dialog).not.toHaveClass("-translate-x-full");
    // Bicicletas/Accesorios stay plain links with no category data (the
    // default here); Ofertas is always an accordion — its content is static,
    // never depends on a fetch.
    for (const label of ["Bicicletas", "Accesorios"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Ofertas" })).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    render(<MobileMenu tone="neutral" />);
    await openMenu();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByRole("button", { name: "Abrir menú" })).toBeInTheDocument();
  });

  it("keeps the toggle stacked above the drawer panel while open, so the ✕ stays reachable", async () => {
    render(<MobileMenu tone="neutral" />);
    await openMenu();

    const toggle = screen.getByRole("button", { name: "Cerrar menú" });
    const dialog = screen.getByRole("dialog");
    expect(toggle).toHaveClass("z-50");
    expect(dialog).toHaveClass("z-40");
  });

  it("links the advisory CTA to WhatsApp with a safe external target", async () => {
    render(<MobileMenu tone="neutral" />);
    await openMenu();

    const cta = screen.getByRole("link", { name: /Asesoría por WhatsApp/ });
    expect(cta).toHaveAttribute("href", expect.stringContaining("https://wa.me/"));
    expect(cta).toHaveAttribute("target", "_blank");
    expect(cta).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the three social links with accessible names", async () => {
    render(<MobileMenu tone="neutral" />);
    await openMenu();

    for (const label of ["Facebook", "Instagram", "TikTok"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("renders a header lockup linking home, separate from the desktop wordmark", async () => {
    render(<MobileMenu tone="neutral" />);
    await openMenu();

    const dialog = screen.getByRole("dialog");
    const lockup = within(dialog).getByRole("link", { name: /black and white bikes/i });
    expect(lockup).toHaveAttribute("href", "/");
  });

  it("without category data, keeps Bicicletas a plain link — no empty accordion", async () => {
    render(<MobileMenu tone="neutral" />);
    await openMenu();

    expect(screen.getByRole("link", { name: "Bicicletas" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bicicletas" })).not.toBeInTheDocument();
  });

  it("with category data, turns Bicicletas into an accordion that expands to its subcategories", async () => {
    render(<MobileMenu tone="neutral" bikeCategories={BIKE_CATEGORIES} />);
    await openMenu();

    const toggle = screen.getByRole("button", { name: "Bicicletas" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    // "Ver todas" and the two categories exist in the DOM but sit inside a
    // collapsed (`inert`) panel — reachable via `hidden: true`, not the
    // default query, mirroring how the drawer's own closed state is tested.
    expect(screen.getByRole("link", { name: "Ver todas", hidden: true })).toHaveAttribute("href", "/bicicletas");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Ruta" })).toHaveAttribute("href", "/bicicletas/ruta");
    expect(screen.getByRole("link", { name: "Montaña" })).toHaveAttribute("href", "/bicicletas/montana");
  });

  it("with brands but no bike categories, still shows the accordion with only the marca sub-list", async () => {
    render(<MobileMenu tone="neutral" brands={[{ id: "b1", name: "Orbea", slug: "orbea", order: 0 }]} />);
    await openMenu();

    const toggle = screen.getByRole("button", { name: "Bicicletas" });
    fireEvent.click(toggle);
    expect(screen.getByRole("link", { name: "Orbea" })).toHaveAttribute("href", "/bicicletas?brand=orbea");
    // "Comprar por categoría" never renders with an empty items list.
    expect(screen.queryByText("Comprar por categoría")).not.toBeInTheDocument();
  });

  it("with accessory category data, turns Accesorios into an accordion", async () => {
    const accessoryCategories: PublicCategoryTreeNode[] = [
      { id: "3", name: "Cascos", slug: "cascos", parent: null, order: 0, usesSizes: false, children: [] },
    ];
    render(<MobileMenu tone="neutral" accessoryCategories={accessoryCategories} />);
    await openMenu();

    const toggle = screen.getByRole("button", { name: "Accesorios" });
    fireEvent.click(toggle);
    expect(screen.getByRole("link", { name: "Cascos" })).toHaveAttribute("href", "/accesorios/cascos");
  });

  it("Ofertas is always an accordion, with a CTA row and no sub-list", async () => {
    render(<MobileMenu tone="neutral" />);
    await openMenu();

    const toggle = screen.getByRole("button", { name: "Ofertas" });
    fireEvent.click(toggle);
    expect(screen.getByRole("link", { name: "Rebajas de bicis y accesorios" })).toHaveAttribute("href", "/ofertas");
  });
});
