import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { BRAND_SOCIAL_LINKS } from "@/lib/brand-social";
import { STOREFRONT_NAV_ITEMS } from "@/lib/storefront-nav";
import { Footer } from "./Footer";

function stubMatchMedia(matches: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

describe("Footer", () => {
  beforeEach(() => {
    stubMatchMedia(false);
  });

  it("opens with the brand name as a single-line headline", () => {
    render(<Footer />);
    const headline = screen.getByRole("heading", { name: "Black and White Bikes" });
    expect(headline).toBeInTheDocument();
    expect(headline).toHaveClass("whitespace-nowrap");
  });

  it("links the wordmark home", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Black and White Bikes — inicio" })).toHaveAttribute("href", "/");
  });

  it("reuses the navbar's own destinations under 'Tienda' instead of a duplicate list", () => {
    render(<Footer />);
    for (const item of STOREFRONT_NAV_ITEMS) {
      expect(screen.getByRole("link", { name: item.label })).toHaveAttribute("href", item.href);
    }
  });

  it("renders the two editorial columns", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Nosotros" })).toHaveAttribute("href", "/nosotros");
    expect(screen.getByRole("link", { name: "Garantía" })).toHaveAttribute("href", "/garantia");
  });

  it("renders every brand social profile as an accessible external link", () => {
    render(<Footer />);
    for (const link of BRAND_SOCIAL_LINKS) {
      const social = screen.getByRole("link", { name: new RegExp(link.network, "i") });
      expect(social).toHaveAttribute("href", link.href);
      expect(social).toHaveAttribute("target", "_blank");
    }
  });

  it("signs off with the gold rhino immediately before the copyright line", () => {
    const { container } = render(<Footer />);
    const rhino = container.querySelector('img[src="/brand/rhino-dorado.svg"]');
    expect(rhino).toBeInTheDocument();
    expect(screen.getByText(/black and white bikes\. todos los derechos reservados\./i)).toBeInTheDocument();
  });

  describe("below sm (mobile accordion)", () => {
    beforeEach(() => {
      stubMatchMedia(true);
    });

    it("collapses every link column by default", () => {
      render(<Footer />);
      const trigger = screen.getByRole("button", { name: "Tienda" });
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    it("expands a column's links on click, independently of the others", () => {
      render(<Footer />);
      fireEvent.click(screen.getByRole("button", { name: "Tienda" }));

      expect(screen.getByRole("button", { name: "Tienda" })).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("button", { name: "Sobre B/W" })).toHaveAttribute("aria-expanded", "false");
    });

    it("keeps collapsed links in the DOM, just inert, instead of unmounting them", () => {
      render(<Footer />);
      const link = screen.getByRole("link", { name: "Nosotros" });
      expect(link).toBeInTheDocument();
      expect(link.closest("[inert]")).not.toBeNull();
    });
  });
});
