"use client";

import type { PublicHeroSlide } from "@bw-bikes/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { HeroControls } from "./HeroControls";
import { HeroSlideContent } from "./HeroSlideContent";
import { HeroSlideMedia } from "./HeroSlideMedia";

const AUTOPLAY_INTERVAL_MS = 6000;

export interface HeroCarouselProps {
  slides: PublicHeroSlide[];
}

/**
 * The home hero's carousel. Keeps `data-navbar-overlay` and `min-h-svh` on
 * its own root — `useNavbarOverlay` (entrega 1) depends on exactly that
 * attribute existing on the first section of `/`, and this replaces the
 * placeholder that used to carry it.
 *
 * Every slide stays mounted, stacked in `absolute inset-0`, and crossfades
 * via opacity — simpler than mounting/unmounting on every advance, and it's
 * what lets the inactive slides' links go `aria-hidden`/`tabIndex={-1}`
 * instead of disappearing from the DOM mid-transition.
 */
export function HeroCarousel({ slides }: HeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const rootRef = useRef<HTMLElement>(null);

  const total = slides.length;

  const goTo = useCallback((index: number) => setActiveIndex(((index % total) + total) % total), [total]);
  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const prev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  // Autoplay: off entirely for a single slide (nothing to advance to), off
  // under `prefers-reduced-motion`, and paused on hover/focus/tab-hidden —
  // every one of those without special-casing which reason paused it, since
  // this effect just re-evaluates "should a timer exist right now" on every
  // dependency change.
  useEffect(() => {
    if (total <= 1 || prefersReducedMotion || paused) return;
    const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % total), AUTOPLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [total, prefersReducedMotion, paused]);

  useEffect(() => {
    function handleVisibilityChange(): void {
      setPaused(document.hidden);
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "ArrowLeft") prev();
      else if (event.key === "ArrowRight") next();
      else return;
      event.preventDefault();
    }
    root.addEventListener("keydown", handleKeyDown);
    return () => root.removeEventListener("keydown", handleKeyDown);
  }, [prev, next]);

  return (
    <section
      ref={rootRef}
      data-navbar-overlay
      aria-roledescription="carousel"
      aria-label="Destacados"
      className="relative min-h-svh w-full overflow-hidden bg-negro"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(document.hidden)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(document.hidden);
      }}
    >
      {slides.map((slide, index) => (
        <div
          key={slide.image.publicId}
          aria-hidden={index !== activeIndex}
          className={`absolute inset-0 transition-opacity duration-700 ${index === activeIndex ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          <HeroSlideMedia slide={slide} isFirst={index === 0} />
          <HeroSlideContent slide={slide} isActive={index === activeIndex} />
        </div>
      ))}

      {total > 1 ? (
        <HeroControls total={total} activeIndex={activeIndex} onSelect={goTo} onPrev={prev} onNext={next} />
      ) : null}
    </section>
  );
}
