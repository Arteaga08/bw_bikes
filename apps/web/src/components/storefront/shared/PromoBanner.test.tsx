import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PromoBanner } from "./PromoBanner";

const IMAGE = { url: "https://res.cloudinary.com/test/bike.jpg" };

describe("PromoBanner", () => {
  it("renders the copy and one link per action", () => {
    render(
      <PromoBanner
        image={IMAGE}
        eyebrow="Comparador"
        title="¿Cuál de las dos es tuya?"
        subtitle="Dato por dato."
        actions={[
          { label: "Comparar", href: "/comparar", variant: "primary" },
          { label: "Conocer más", href: "/otra", variant: "ghost" },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "¿Cuál de las dos es tuya?" })).toBeInTheDocument();
    expect(screen.getByText("Comparador")).toBeInTheDocument();
    expect(screen.getByText("Dato por dato.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Comparar" })).toHaveAttribute("href", "/comparar");
    expect(screen.getByRole("link", { name: "Conocer más" })).toHaveAttribute("href", "/otra");
  });

  it("falls back to the title as alt text when the image has none", () => {
    render(<PromoBanner image={IMAGE} title="Bici del mes" actions={[]} />);

    expect(screen.getByAltText("Bici del mes")).toBeInTheDocument();
  });

  it("omits the eyebrow, the subtitle and the button row when not given", () => {
    render(<PromoBanner image={IMAGE} title="Solo título" actions={[]} />);

    expect(screen.getByRole("heading", { name: "Solo título" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders the eyebrow icon only when the caller passes one", () => {
    const { rerender } = render(
      <PromoBanner
        image={IMAGE}
        title="Bici del mes"
        eyebrow="Nueva temporada"
        eyebrowIcon={<span data-testid="rhino" />}
        actions={[]}
      />,
    );
    expect(screen.getByTestId("rhino")).toBeInTheDocument();

    rerender(<PromoBanner image={IMAGE} title="Bici del mes" eyebrow="Nueva temporada" actions={[]} />);
    expect(screen.queryByTestId("rhino")).not.toBeInTheDocument();
  });

  it("mirrors the scrim, the mobile crop and the copy block together when aligned right", () => {
    const { container } = render(
      <PromoBanner image={IMAGE} title="Derecha" actions={[]} align="right" />,
    );

    // Las tres piezas tienen que voltearse juntas: un scrim que oscurece el lado
    // vacío, o un recorte que corre la bici hacia el texto, es el bug que este
    // caso protege.
    expect(container.querySelector(".bg-gradient-to-l")).not.toBeNull();
    expect(container.querySelector(".bg-gradient-to-r")).toBeNull();
    expect(screen.getByAltText("Derecha").className).toContain("object-[20%_center]");
    expect(container.querySelector(".sm\\:items-end")).not.toBeNull();
  });

  it("keeps the left layout by default", () => {
    const { container } = render(<PromoBanner image={IMAGE} title="Izquierda" actions={[]} />);

    expect(container.querySelector(".bg-gradient-to-r")).not.toBeNull();
    expect(container.querySelector(".bg-gradient-to-l")).toBeNull();
    expect(screen.getByAltText("Izquierda").className).toContain("object-[80%_center]");
    expect(container.querySelector(".sm\\:items-end")).toBeNull();
  });
});
