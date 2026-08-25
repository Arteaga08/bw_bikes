"use client";

import type { PublicCategoryTreeNode } from "@bw-bikes/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { CategoryCard } from "./CategoryCard";
import { CategoryCarouselArrows } from "./CategoryCarouselArrows";
import { CategoryCarouselProgress } from "./CategoryCarouselProgress";

export interface CategoryCarouselProps {
  categories: PublicCategoryTreeNode[];
}

// A one-pixel slack keeps `canScrollRight` from flapping true/false on
// browsers that report fractional `scrollWidth` values.
const SCROLL_EDGE_SLACK_PX = 1;

/**
 * The category rail. Deliberately built on native scroll — `overflow-x-auto`
 * + `snap-x` — rather than a translate-based track like `HeroCarousel`: this
 * is a list of five-plus tiles a shopper browses at their own pace, not a
 * single active slide advancing on a clock, so swipe/trackpad scroll is the
 * base interaction and the arrows are a convenience on top of it, not the
 * only way through.
 *
 * `role="group"`, not `aria-roledescription="carousel"` — unlike the hero,
 * there's no single "active" item here, just a scrollable list. Labeling it
 * a carousel would promise slide-by-slide semantics this component doesn't
 * have.
 */
export function CategoryCarousel({ categories }: CategoryCarouselProps) {
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
    // `group/carousel` so the arrows (rendered outside the scroll track, to
    // stay fixed while it scrolls) can react to hover/focus anywhere on the
    // rail, not just when the pointer is directly over a 44px button.
    <div className="group/carousel relative">
      <div
        ref={trackRef}
        role="group"
        aria-label="Categorías de bicicletas"
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
        className="flex gap-lg overflow-x-auto pl-lg pr-lg snap-x snap-mandatory scroll-pl-lg [scrollbar-width:none] sm:pl-[clamp(2rem,8vw,8rem)] sm:pr-xl sm:scroll-pl-[clamp(2rem,8vw,8rem)] [&::-webkit-scrollbar]:hidden"
      >
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}
      </div>

      <CategoryCarouselArrows
        canScrollLeft={canScrollLeft}
        canScrollRight={canScrollRight}
        onScrollLeft={() => scrollByTile(-1)}
        onScrollRight={() => scrollByTile(1)}
      />

      <CategoryCarouselProgress scrollRatio={scrollMetrics.scrollRatio} visibleRatio={scrollMetrics.visibleRatio} />
    </div>
  );
}
