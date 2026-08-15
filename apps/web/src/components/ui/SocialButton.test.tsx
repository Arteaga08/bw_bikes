import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SocialButton } from "./SocialButton";

describe("SocialButton", () => {
  it("opens the profile in a new tab without handing it a window.opener reference", () => {
    render(<SocialButton network="instagram" href="https://instagram.com/bnwbikes" />);

    const link = screen.getByRole("link", { name: "Instagram" });
    expect(link).toHaveAttribute("href", "https://instagram.com/bnwbikes");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("names every network, because the glyph alone says nothing to a screen reader", () => {
    const { rerender } = render(<SocialButton network="facebook" href="https://facebook.com/x" />);
    expect(screen.getByRole("link", { name: "Facebook" })).toBeInTheDocument();

    rerender(<SocialButton network="whatsapp" href="https://wa.me/521" />);
    expect(screen.getByRole("link", { name: "WhatsApp" })).toBeInTheDocument();

    rerender(<SocialButton network="youtube" href="https://youtube.com/@x" />);
    expect(screen.getByRole("link", { name: "YouTube" })).toBeInTheDocument();
  });

  it("defaults to the inverse tone — its home is the footer over the overlay surface", () => {
    render(<SocialButton network="instagram" href="https://instagram.com/x" />);
    const link = screen.getByRole("link", { name: "Instagram" });
    expect(link).toHaveClass("text-blanco/70");
    expect(link).toHaveClass("hover:text-dorado");
  });

  it("takes the neutral tone when it sits on a light surface instead", () => {
    render(<SocialButton network="instagram" href="https://instagram.com/x" tone="neutral" />);
    const link = screen.getByRole("link", { name: "Instagram" });
    expect(link).toHaveClass("text-grafito");
    expect(link).not.toHaveClass("text-blanco/70");
  });
});
