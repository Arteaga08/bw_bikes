import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { PublicBrand } from "@bw-bikes/shared";
import { BrandMarquee } from "./BrandMarquee";

function makeBrand(overrides: Partial<PublicBrand> = {}): PublicBrand {
  return {
    id: `b-${Math.random()}`,
    name: "Trek",
    slug: "trek",
    order: 0,
    logo: { publicId: "p", url: "https://res.cloudinary.com/test/trek.png", width: 200, height: 80 },
    ...overrides,
  };
}

/** Same helper shape as `CategoryCarousel.test.tsx`/`HeroCarousel.test.tsx`. */
function stubMatchMedia(reducedMotion: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? reducedMotion : true,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

describe("BrandMarquee", () => {
  beforeEach(() => {
    stubMatchMedia(false);
  });

  it("renders one visible list with an accessible label, plus hidden duplicate copies for the loop", () => {
    render(<BrandMarquee brands={[makeBrand({ name: "Trek" }), makeBrand({ name: "Giant" })]} />);

    const lists = screen.getAllByRole("list", { hidden: true });
    expect(lists).toHaveLength(3);

    const visible = screen.getByRole("list");
    const hiddenCopies = lists.filter((list) => list !== visible);
    expect(visible).toHaveAccessibleName("Marcas que manejamos");
    expect(within(visible).getByAltText("Trek")).toBeInTheDocument();
    expect(within(visible).getByAltText("Giant")).toBeInTheDocument();

    for (const copy of hiddenCopies) {
      expect(copy).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("collapses to a single, unanimated copy under prefers-reduced-motion", () => {
    stubMatchMedia(true);
    render(<BrandMarquee brands={[makeBrand()]} />);

    const list = screen.getByRole("list");
    expect(screen.getAllByRole("list", { hidden: true })).toHaveLength(1);
    expect(list.parentElement).not.toHaveClass("animate-brand-marquee");
  });
});
