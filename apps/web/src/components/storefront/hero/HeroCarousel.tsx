"use client";

import type { PublicHeroSlide } from "@bw-bikes/shared";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { HeroControls } from "./HeroControls";
import { HeroSlideContent } from "./HeroSlideContent";
import { HeroSlideMedia } from "./HeroSlideMedia";

const AUTOPLAY_INTERVAL_MS = 6000;

type Direction = 1 | -1;

export interface HeroCarouselProps {
  slides: PublicHeroSlide[];
}

/**
 * The home hero's carousel. Keeps `data-navbar-overlay` and `min-h-svh` on
 * its own root — `useNavbarOverlay` (entrega 1) depends on exactly that
 * attribute existing on the first section of `/`.
 *
 * Two layers, deliberately decoupled:
 *
 * 1. The photos. Every slide stays mounted side by side in one flex row, and
 *    advancing translates that row by a whole viewport width — a real
 *    horizontal slide, not an opacity crossfade (Manuel's explicit call).
 *    `translateX(-index * 100%)` handles both directions for free.
 * 2. The copy and the action rail. One instance, one column, anchored
 *    bottom-left in normal flow, rendering only the active slide.
 *
 * Layer 2 used to be two independent `absolute` boxes with different widths
 * and different insets, which is why the CTA, the dashes and the arrows never
 * lined up no matter how the paddings were tuned: stacking absolute boxes by
 * fixed offsets can't survive copy whose height changes with the subtitle,
 * the CTA count and how many lines the title wraps to. One flow column makes
 * the shared rail structural instead of something to re-tune every round.
 *
 * Because the copy no longer rides the photo's transform, it gets its own
 * entrance (`hero-in`, direction-aware) so it enters with the photo rather
 * than popping. The dashes and arrows deliberately stay mounted across slide
 * changes: remounting them would drop keyboard focus every time someone
 * clicks the arrow they are currently focused on.
 */
export function HeroCarousel({ slides }: HeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<Direction>(1);
  const [paused, setPaused] = useState(false);
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const rootRef = useRef<HTMLElement>(null);

  const total = slides.length;
  const activeSlide = slides[activeIndex];

  const jumpTo = useCallback(
    (index: number, nextDirection: Direction) => {
      setDirection(nextDirection);
      setActiveIndex(((index % total) + total) % total);
    },
    [total],
  );

  // A dash jump reads as forward or backward depending on where it lands;
  // the arrows and the autoplay always know their own direction.
  const goTo = useCallback((index: number) => jumpTo(index, index >= activeIndex ? 1 : -1), [jumpTo, activeIndex]);
  const next = useCallback(() => jumpTo(activeIndex + 1, 1), [jumpTo, activeIndex]);
  const prev = useCallback(() => jumpTo(activeIndex - 1, -1), [jumpTo, activeIndex]);

  // Autoplay: off entirely for a single slide (nothing to advance to), off
  // under `prefers-reduced-motion`, and paused on hover/focus/tab-hidden —
  // every one of those without special-casing which reason paused it, since
  // this effect just re-evaluates "should a timer exist right now" on every
  // dependency change.
  useEffect(() => {
    if (total <= 1 || prefersReducedMotion || paused) return;
    const timer = window.setInterval(() => {
      setDirection(1);
      setActiveIndex((current) => (current + 1) % total);
    }, AUTOPLAY_INTERVAL_MS);
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

  // `slides` is never empty in practice: `HomeHero` renders its own fallback
  // (which carries `data-navbar-overlay` itself) when the API returns none.
  // The guard exists so `activeSlide` is a value and not `T | undefined`, and
  // it sits below every hook so the hook order stays unconditional.
  if (!activeSlide) return null;

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
      <div
        // No transition class at all under `prefers-reduced-motion` — not
        // just a shorter duration — so the slide change is an instant jump,
        // same treatment the autoplay effect already gives that media query.
        className={`flex min-h-svh ${prefersReducedMotion ? "" : "transition-transform duration-500 ease-out"}`}
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {slides.map((slide, index) => (
          <div key={slide.image.publicId} aria-hidden={index !== activeIndex} className="relative w-full shrink-0">
            <HeroSlideMedia slide={slide} isFirst={index === 0} />
          </div>
        ))}
      </div>

      {/* The column's anchor. `pointer-events-none` so this full-bleed box
          never sits between the pointer and the photo; the column itself
          takes its events back. The left inset is fluid rather than a token
          step: at ~1470px it lands on the reference's ~125px, and it keeps
          scaling on wide monitors instead of hugging the edge. */}
      <div className="pointer-events-none absolute inset-0 flex items-end px-lg pb-2xl sm:pr-xl sm:pb-[5.5rem] sm:pl-[clamp(2rem,8vw,8rem)]">
        <div
          className="pointer-events-auto w-full sm:max-w-[34rem]"
          // Inherited by both animated children, so the copy and the CTAs
          // enter from whichever side the carousel just came from.
          style={{ "--hero-in-from": direction === 1 ? "2rem" : "-2rem" } as CSSProperties}
        >
          {/* `max-w-[34rem]` arbitrary, never `max-w-lg` — Tailwind v4 resolves
              `max-w-{key}` against `--spacing-{key}` before its own
              `--container-{key}` default (see the warning in `globals.css`),
              which is how an earlier round capped this block at 48px wide. */}
          <HeroSlideContent key={activeIndex} slide={activeSlide} />

          <HeroControls
            ctas={activeSlide.ctas}
            total={total}
            activeIndex={activeIndex}
            onSelect={goTo}
            onPrev={prev}
            onNext={next}
          />
        </div>
      </div>
    </section>
  );
}
