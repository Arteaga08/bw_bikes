import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PublicHomeTile } from "@bw-bikes/shared";
import { HomeCategoryCtaTile } from "./HomeCategoryCtaTile";

function makeTile(overrides: Partial<PublicHomeTile> = {}): PublicHomeTile {
  return {
    slot: "bikes",
    image: { publicId: "p", url: "https://res.cloudinary.com/test/bikes.jpg", width: 1200, height: 900 },
    ...overrides,
  };
}

describe("HomeCategoryCtaTile", () => {
  it("renders the title and links to the given destination", () => {
    render(<HomeCategoryCtaTile tile={makeTile()} label="Comprar Bicicletas" href="/bicicletas" corner="right" />);

    const link = screen.getByRole("link", { name: /comprar bicicletas/i });
    expect(link).toHaveAttribute("href", "/bicicletas");
    expect(screen.getByText("Comprar Bicicletas")).toBeInTheDocument();
  });

  it("falls back to the label as alt text when the image has none", () => {
    render(<HomeCategoryCtaTile tile={makeTile({ image: { ...makeTile().image, alt: undefined } })} label="Comprar Accesorios" href="/accesorios" corner="left" />);

    expect(screen.getByAltText("Comprar Accesorios")).toBeInTheDocument();
  });
});
