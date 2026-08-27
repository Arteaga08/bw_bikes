import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { usePathnameMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: usePathnameMock }));

const { StorefrontNavLinks } = await import("./StorefrontNavLinks");

function renderAt(pathname: string) {
  usePathnameMock.mockReturnValue(pathname);
  return render(<StorefrontNavLinks tone="neutral" />);
}

/** The animated underline span — distinguished from the icon slot's own `aria-hidden` span by its `absolute` positioning class (see `ButtonContent`'s `text` variant). */
function underlineOf(trigger: HTMLElement): Element | null {
  return trigger.querySelector("span.absolute[aria-hidden='true']");
}

describe("StorefrontNavLinks", () => {
  it("renders the three public destinations as disclosure triggers, not links", () => {
    renderAt("/");
    for (const label of ["Bicicletas", "Accesorios", "Ofertas"]) {
      const trigger = screen.getByRole("button", { name: label });
      expect(trigger.tagName).toBe("BUTTON");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    }
  });

  it("opens a panel on click, exposing a real navigable CTA link inside it, and closes on a second click", () => {
    renderAt("/");
    const trigger = screen.getByRole("button", { name: "Ofertas" });

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    // The photo tile's own link carries the heading copy; the standalone
    // button carries the actual call to action — both point to /ofertas.
    expect(screen.getByRole("link", { name: "Rebajas de bicicletas" })).toHaveAttribute("href", "/ofertas");
    expect(screen.getByRole("link", { name: "Ver rebajas" })).toHaveAttribute("href", "/ofertas");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("only ever has one panel open at a time", () => {
    renderAt("/");
    const bicicletas = screen.getByRole("button", { name: "Bicicletas" });
    const accesorios = screen.getByRole("button", { name: "Accesorios" });

    fireEvent.click(bicicletas);
    expect(bicicletas).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(accesorios);
    expect(accesorios).toHaveAttribute("aria-expanded", "true");
    expect(bicicletas).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the open panel on Escape", () => {
    renderAt("/");
    const trigger = screen.getByRole("button", { name: "Bicicletas" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("marks the current section current on a sub-route, with the underline pinned open", () => {
    renderAt("/accesorios/casco-mtb");
    const active = screen.getByRole("button", { name: "Accesorios" });
    expect(underlineOf(active)).toHaveClass("scale-x-100");

    const inactive = screen.getByRole("button", { name: "Bicicletas" });
    expect(underlineOf(inactive)).toHaveClass("scale-x-0");
  });
});
