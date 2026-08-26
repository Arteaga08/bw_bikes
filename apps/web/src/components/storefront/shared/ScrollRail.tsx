"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ScrollRailArrows } from "./ScrollRailArrows";
import { ScrollRailProgress } from "./ScrollRailProgress";

export interface ScrollRailProps {
  /** The tiles. Each one must set its own `shrink-0 basis-* snap-start`. */
  children: ReactNode;
  /** Names the scrollable region for assistive tech, e.g. "Categorías de bicicletas". */
  ariaLabel: string;
  /** Screen-reader label for the "back" arrow, e.g. "Categorías anteriores". */
  previousLabel: string;
  /** Screen-reader label for the "forward" arrow, e.g. "Siguientes categorías". */
  nextLabel: string;
}

// A one-pixel slack keeps `canScrollRight` from flapping true/false on
// browsers that report fractional `scrollWidth` values.
const SCROLL_EDGE_SLACK_PX = 1;

/**
 * The horizontal rail every home section that shows a row of tiles is built
 * on. Deliberately built on native scroll — `overflow-x-auto` + `snap-x` —
 * rather than a translate-based track like `HeroCarousel`: this is a list of
 * five-plus tiles a shopper browses at their own pace, not a single active
 * slide advancing on a clock, so swipe/trackpad scroll is the base
 * interaction and the arrows are a convenience on top of it, not the only way
 * through.
 *
 * `role="group"`, not `aria-roledescription="carousel"` — unlike the hero,
 * there's no single "active" item here, just a scrollable list. Labeling it
 * a carousel would promise slide-by-slide semantics this component doesn't
 * have.
 *
 * It owns the *mechanics* only (scroll edges, snap, arrows, progress) and
 * knows nothing about what a tile is — `CategoryCarousel` and
 * `ProductCarousel` are the thin components that supply the tiles and the
 * Spanish labels.
 */
export function ScrollRail({ children, ariaLabel, previousLabel, nextLabel }: ScrollRailProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [scrollMetrics, setScrollMetrics] = useState({ scrollRatio: 0, visibleRatio: 1 });
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const updateEdges = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanScrollLeft(track.scrollLeft > SCROLL_EDGE_SLACK_PX);
    setCanScrollRight(track.scrollLeft + track.clientWidth < track.scrollWidth - SCROLL_EDGE_SLACK_PX);

    const maxScroll = track.scrollWidth - track.clientWidth;
    setScrollMetrics({
      scrollRatio: maxScroll > 0 ? track.scrollLeft / maxScroll : 0,
      visibleRatio: track.scrollWidth > 0 ? track.clientWidth / track.scrollWidth : 1,
    });
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    updateEdges();
    track.addEventListener("scroll", updateEdges, { passive: true });

    // The number of visible tiles changes at every breakpoint, so a resize
    // can flip both edges at once (e.g. going from "5th tile peeking" to "all
    // tiles fit") without ever firing a `scroll` event.
    const resizeObserver = new ResizeObserver(updateEdges);
    resizeObserver.observe(track);

    return () => {
      track.removeEventListener("scroll", updateEdges);
      resizeObserver.disconnect();
    };
  }, [updateEdges]);

  const scrollByTile = useCallback(
    (direction: 1 | -1) => {
      const track = trackRef.current;
      const tile = track?.firstElementChild;
      if (!track || !tile) return;
      track.scrollBy({
        left: direction * tile.getBoundingClientRect().width,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    },
    [prefersReducedMotion],
  );

  return (
    // `group/rail` so the arrows (rendered outside the scroll track, to
    // stay fixed while it scrolls) can react to hover/focus anywhere on the
    // rail, not just when the pointer is directly over a 44px button.
    <div className="group/rail relative">
      <div
        ref={trackRef}
        role="group"
        aria-label={ariaLabel}
        // `snap-mandatory` + `scroll-pl-*` aligns every snapped tile to the
        // same left inset the hero's copy column uses
        // (`sm:pl-[clamp(2rem,8vw,8rem)]` in `HeroCarousel`), so the two
        // sections read as one page rather than two independently-padded
        // blocks. Scrollbar hidden because the snap dots/arrows already
        // communicate "more content" — a native scrollbar under a photo rail
        // is visual noise the reference doesn't have either.
        // No `scroll-smooth` class here — `scrollByTile` below already passes
        // an explicit `behavior` per call (smooth normally, `"auto"` under
        // `prefers-reduced-motion`), and a static class would only duplicate
        // that decision instead of driving it.
        // `overflow-y-hidden` is load-bearing, not decorative: per the CSS
        // Overflow spec, an `overflow-x` other than `visible` paired with a
        // `overflow-y` left at its `visible` default gets that `visible`
        // computed up to `auto` too — silently turning this rail into a
        // vertical scroll container as well, which traps the desktop mouse
        // wheel instead of letting it bubble up to scroll the page.
        className="flex gap-lg overflow-x-auto overflow-y-hidden pl-lg pr-lg snap-x snap-mandatory scroll-pl-lg [scrollbar-width:none] sm:pl-[clamp(2rem,8vw,8rem)] sm:pr-xl sm:scroll-pl-[clamp(2rem,8vw,8rem)] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>

      <ScrollRailArrows
        canScrollLeft={canScrollLeft}
        canScrollRight={canScrollRight}
        onScrollLeft={() => scrollByTile(-1)}
        onScrollRight={() => scrollByTile(1)}
        previousLabel={previousLabel}
        nextLabel={nextLabel}
      />

      <ScrollRailProgress scrollRatio={scrollMetrics.scrollRatio} visibleRatio={scrollMetrics.visibleRatio} />
    </div>
  );
}
