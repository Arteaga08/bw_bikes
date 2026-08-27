import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BRAND_SOCIAL_LINKS } from "@/lib/brand-social";
import { STOREFRONT_NAV_ITEMS } from "@/lib/storefront-nav";
import { Footer } from "./Footer";

describe("Footer", () => {
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
});
