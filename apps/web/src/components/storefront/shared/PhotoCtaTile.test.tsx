import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PhotoCtaTile } from "./PhotoCtaTile";

describe("PhotoCtaTile", () => {
  it("renders an internal `next/link` by default", () => {
    render(
      <PhotoCtaTile
        image={{ url: "https://res.cloudinary.com/test/bikes.jpg" }}
        label="Comprar Bicicletas"
        href="/bicicletas"
      />,
    );

    const link = screen.getByRole("link", { name: /comprar bicicletas/i });
    expect(link).toHaveAttribute("href", "/bicicletas");
    expect(link).not.toHaveAttribute("target");
    expect(screen.getByText("Comprar Bicicletas")).toBeInTheDocument();
  });

  it("renders an external `<a target=\"_blank\">` with `rel=\"noopener noreferrer\"` when `external` is set", () => {
    render(
      <PhotoCtaTile
        image={{ url: "https://res.cloudinary.com/test/sucursal.jpg" }}
        label="Visítanos"
        href="https://maps.google.com/?q=Black+and+White+Bikes"
        external
      />,
    );

    const link = screen.getByRole("link", { name: /visítanos/i });
    expect(link).toHaveAttribute("href", "https://maps.google.com/?q=Black+and+White+Bikes");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("falls back to the label as alt text when the image has none", () => {
    render(<PhotoCtaTile image={{ url: "https://res.cloudinary.com/test/x.jpg" }} label="Comprar Accesorios" href="/accesorios" />);

    expect(screen.getByAltText("Comprar Accesorios")).toBeInTheDocument();
  });

  it("omits the rhino when `rhinoCorner` is not set", () => {
    render(<PhotoCtaTile image={{ url: "https://res.cloudinary.com/test/x.jpg" }} label="Te asesoramos" href="https://wa.me/123" external />);

    expect(screen.queryByAltText("")).not.toBeInTheDocument();
  });

  it("renders the rhino at the given corner when `rhinoCorner` is set", () => {
    const { container } = render(
      <PhotoCtaTile image={{ url: "https://res.cloudinary.com/test/x.jpg" }} label="Comprar Bicicletas" href="/bicicletas" rhinoCorner="left" />,
    );

    const rhino = container.querySelector('img[src="/brand/rhino-dorado.svg"]');
    expect(rhino).toHaveClass("left-lg");
  });
});
