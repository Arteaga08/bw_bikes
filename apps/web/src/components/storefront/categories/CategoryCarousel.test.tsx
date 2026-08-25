import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicCategoryTreeNode } from "@bw-bikes/shared";
import { CategoryCarousel } from "./CategoryCarousel";

function makeCategory(overrides: Partial<PublicCategoryTreeNode> = {}): PublicCategoryTreeNode {
  return {
    id: `c-${Math.random()}`,
    name: "Carretera",
    slug: "carretera",
    parent: null,
    order: 0,
    usesSizes: true,
    image: { publicId: "p", url: "https://res.cloudinary.com/test/x.jpg", width: 800, height: 1000 },
    children: [],
    ...overrides,
  };
}

/** Overrides the shared `matches: true` default from `vitest.setup.ts` so `prefers-reduced-motion` can be controlled per test — same helper shape as `HeroCarousel.test.tsx`. */
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

describe("CategoryCarousel", () => {
  beforeEach(() => {
    stubMatchMedia(false);
    // jsdom never lays elements out, so every card reports 0 width. The
    // carousel reads `getBoundingClientRect().width` off the first tile to
    // size a "page" scroll — stub it so `scrollByTile` has a real number.
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 320,
      height: 400,
      top: 0,
      left: 0,
      right: 320,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON: () => {},
    })) as unknown as () => DOMRect;

    // jsdom also never computes real scroll metrics, so `clientWidth` and
    // `scrollWidth` are both 0 by default — `updateEdges` would read that as
    // "nothing left to scroll to" and disable the right arrow in every test.
    // Stub a track wider than its viewport so the right arrow starts enabled.
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 960 });
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, value: 2000 });
  });

  it("renders one card per category, linking to /bicicletas/[slug]", () => {
    render(
      <CategoryCarousel
        categories={[makeCategory({ name: "Carretera", slug: "carretera" }), makeCategory({ name: "Montaña", slug: "montana" })]}
      />,
    );

    expect(screen.getByRole("link", { name: /Carretera/ })).toHaveAttribute("href", "/bicicletas/carretera");
    expect(screen.getByRole("link", { name: /Montaña/ })).toHaveAttribute("href", "/bicicletas/montana");
  });

  it("starts with the left arrow disabled", () => {
    render(<CategoryCarousel categories={[makeCategory(), makeCategory()]} />);
    expect(screen.getByRole("button", { name: "Categorías anteriores" })).toBeDisabled();
  });

  it("scrolls the track forward when the right arrow is clicked", () => {
    render(<CategoryCarousel categories={[makeCategory(), makeCategory(), makeCategory()]} />);
    const track = screen.getByRole("group", { name: "Categorías de bicicletas" });
    const scrollBySpy = vi.fn();
    track.scrollBy = scrollBySpy;

    fireEvent.click(screen.getByRole("button", { name: "Siguientes categorías" }));

    expect(scrollBySpy).toHaveBeenCalledWith(expect.objectContaining({ left: 320, behavior: "smooth" }));
  });

  it("scrolls without smooth behavior under prefers-reduced-motion", () => {
    stubMatchMedia(true);
    render(<CategoryCarousel categories={[makeCategory(), makeCategory()]} />);
    const track = screen.getByRole("group", { name: "Categorías de bicicletas" });
    const scrollBySpy = vi.fn();
    track.scrollBy = scrollBySpy;

    fireEvent.click(screen.getByRole("button", { name: "Siguientes categorías" }));

    expect(scrollBySpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: "auto" }));
  });
});
