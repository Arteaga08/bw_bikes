import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicHeroSlide } from "@bw-bikes/shared";
import { HeroCarousel } from "./HeroCarousel";

function makeSlide(overrides: Partial<PublicHeroSlide> = {}): PublicHeroSlide {
  return {
    image: { publicId: `p-${Math.random()}`, url: "https://res.cloudinary.com/test/x.jpg", width: 2000, height: 1200 },
    focalPoint: "center",
    title: "Slide",
    ctas: [{ label: "Ver bici", href: "/bicicletas/rhino" }],
    ...overrides,
  };
}

/** Overrides the shared `matches: true` default from `vitest.setup.ts` so `prefers-reduced-motion` can be controlled per test. */
/** `{activeIndex + 1} | {total}` renders as separate text nodes — a plain string match against `screen.getByText` won't find it, so this matches on the assembled `textContent` of the counter's own `<p>` instead. */
/** `vi.advanceTimersByTimeAsync` fires the interval callback, but only `act` flushes the resulting `setState` into the DOM — same reasoning as `use-debounced-value.test.tsx`'s `advance`. */
async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function findCounter(expected: string) {
  return screen.getByText((_, element) => element?.tagName.toLowerCase() === "p" && element.textContent === expected);
}

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

describe("HeroCarousel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubMatchMedia(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows no controls for a single slide", () => {
    render(<HeroCarousel slides={[makeSlide({ title: "Único" })]} />);
    expect(screen.getByText("Único")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Siguiente slide" })).not.toBeInTheDocument();
  });

  it("advances and retreats via the arrows, and the counter reflects the index", () => {
    render(<HeroCarousel slides={[makeSlide({ title: "Uno" }), makeSlide({ title: "Dos" }), makeSlide({ title: "Tres" })]} />);

    expect(findCounter("1 | 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente slide" }));
    expect(findCounter("2 | 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Slide anterior" }));
    expect(findCounter("1 | 3")).toBeInTheDocument();
  });

  it("jumps directly via a progress dash", () => {
    render(<HeroCarousel slides={[makeSlide({ title: "Uno" }), makeSlide({ title: "Dos" })]} />);
    fireEvent.click(screen.getByRole("button", { name: "Slide 2 de 2" }));
    expect(findCounter("2 | 2")).toBeInTheDocument();
  });

  it("auto-advances after the interval", async () => {
    render(<HeroCarousel slides={[makeSlide({ title: "Uno" }), makeSlide({ title: "Dos" })]} />);
    expect(findCounter("1 | 2")).toBeInTheDocument();

    await advance(6000);
    expect(findCounter("2 | 2")).toBeInTheDocument();
  });

  it("pauses the autoplay while the pointer is over the carousel", async () => {
    render(<HeroCarousel slides={[makeSlide({ title: "Uno" }), makeSlide({ title: "Dos" })]} />);
    const region = screen.getByRole("region", { name: "Destacados" });

    fireEvent.mouseEnter(region);
    await advance(20_000);
    expect(findCounter("1 | 2")).toBeInTheDocument();
  });

  it("never auto-advances under prefers-reduced-motion", async () => {
    stubMatchMedia(true);
    render(<HeroCarousel slides={[makeSlide({ title: "Uno" }), makeSlide({ title: "Dos" })]} />);

    await advance(20_000);
    expect(findCounter("1 | 2")).toBeInTheDocument();
  });
});
