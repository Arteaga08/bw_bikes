import type { PublicCategoryTreeNode } from "@bw-bikes/shared";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { usePathnameMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn(() => "/") }));
vi.mock("next/navigation", () => ({ usePathname: usePathnameMock }));

const { MobileMenu } = await import("./MobileMenu");

const BIKE_CATEGORIES: PublicCategoryTreeNode[] = [
  { id: "1", name: "Ruta", slug: "ruta", parent: null, order: 0, usesSizes: true, children: [] },
  { id: "2", name: "Montaña", slug: "montana", parent: null, order: 1, usesSizes: true, children: [] },
];

describe("MobileMenu", () => {
  it("starts closed, with the drawer inert", () => {
    render(<MobileMenu tone="neutral" />);
    expect(screen.getByRole("button", { name: "Abrir menú" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { hidden: true })).toHaveAttribute("inert", "");
  });

  it("opens on toggle, exposing the three nav links inside the drawer, entering from the left", () => {
    render(<MobileMenu tone="neutral" />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));

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

  it("closes on Escape", () => {
    render(<MobileMenu tone="neutral" />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByRole("button", { name: "Abrir menú" })).toBeInTheDocument();
  });

  it("keeps the toggle stacked above the drawer panel while open, so the ✕ stays reachable", () => {
    render(<MobileMenu tone="neutral" />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));

    const toggle = screen.getByRole("button", { name: "Cerrar menú" });
    const dialog = screen.getByRole("dialog");
    expect(toggle).toHaveClass("z-50");
    expect(dialog).toHaveClass("z-40");
  });

  it("links the advisory CTA to WhatsApp with a safe external target", () => {
    render(<MobileMenu tone="neutral" />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));

    const cta = screen.getByRole("link", { name: /Asesoría por WhatsApp/ });
    expect(cta).toHaveAttribute("href", expect.stringContaining("https://wa.me/"));
    expect(cta).toHaveAttribute("target", "_blank");
    expect(cta).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the three social links with accessible names", () => {
    render(<MobileMenu tone="neutral" />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));

    for (const label of ["Facebook", "Instagram", "TikTok"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("renders a header lockup linking home, separate from the desktop wordmark", () => {
    render(<MobileMenu tone="neutral" />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));

    const dialog = screen.getByRole("dialog");
    const lockup = within(dialog).getByRole("link", { name: /black and white bikes/i });
    expect(lockup).toHaveAttribute("href", "/");
  });

  it("without category data, keeps Bicicletas a plain link — no empty accordion", () => {
    render(<MobileMenu tone="neutral" />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));

    expect(screen.getByRole("link", { name: "Bicicletas" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bicicletas" })).not.toBeInTheDocument();
  });

  it("with category data, turns Bicicletas into an accordion that expands to its subcategories", () => {
    render(<MobileMenu tone="neutral" bikeCategories={BIKE_CATEGORIES} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));

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

  it("with brands but no bike categories, still shows the accordion with only the marca sub-list", () => {
    render(<MobileMenu tone="neutral" brands={[{ id: "b1", name: "Orbea", slug: "orbea", order: 0 }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));

    const toggle = screen.getByRole("button", { name: "Bicicletas" });
    fireEvent.click(toggle);
    expect(screen.getByRole("link", { name: "Orbea" })).toHaveAttribute("href", "/bicicletas?brand=orbea");
    // "Comprar por categoría" never renders with an empty items list.
    expect(screen.queryByText("Comprar por categoría")).not.toBeInTheDocument();
  });

  it("with accessory category data, turns Accesorios into an accordion", () => {
    const accessoryCategories: PublicCategoryTreeNode[] = [
      { id: "3", name: "Cascos", slug: "cascos", parent: null, order: 0, usesSizes: false, children: [] },
    ];
    render(<MobileMenu tone="neutral" accessoryCategories={accessoryCategories} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));

    const toggle = screen.getByRole("button", { name: "Accesorios" });
    fireEvent.click(toggle);
    expect(screen.getByRole("link", { name: "Cascos" })).toHaveAttribute("href", "/accesorios/cascos");
  });

  it("Ofertas is always an accordion, with a CTA row and no sub-list", () => {
    render(<MobileMenu tone="neutral" />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));

    const toggle = screen.getByRole("button", { name: "Ofertas" });
    fireEvent.click(toggle);
    expect(screen.getByRole("link", { name: "Rebajas de bicicletas" })).toHaveAttribute("href", "/ofertas");
  });
});
