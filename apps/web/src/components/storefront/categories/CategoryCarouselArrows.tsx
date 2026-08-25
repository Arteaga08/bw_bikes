"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react/ssr";

export interface CategoryCarouselArrowsProps {
  canScrollLeft: boolean;
  canScrollRight: boolean;
  onScrollLeft: () => void;
  onScrollRight: () => void;
}

/**
 * The rail's two overlaid arrows. Manuel's explicit call: consistent with
 * *this* system, not a copy of the reference's chrome — a solid 44px square
 * (the system's own control height) in `negro`, not a blurred glass pill.
 * `rounded-control` (2px) and no `box-shadow`, same "precision, not
 * softness" + Flat-By-Default rules the buttons already follow
 * (`DESIGN.md` §4–5); the square sits on the `overlay` layer over the photo
 * instead of faking elevation with a shadow.
 *
 * Visibility is the other half of the ask: invisible at rest, a sutile fade
 * on hover of the rail (`group-hover/carousel`), and — because
 * `pointer-events-none` at `opacity-0` would otherwise strand keyboard users
 * on an unreachable control — also on `:focus-visible` and
 * `group-focus-within/carousel`, so Tab reveals them exactly like a mouse
 * hover would. Touch never triggers `:hover`, so on a phone these correctly
 * never appear; the gesture there is the swipe itself.
 */
export function CategoryCarouselArrows({
  canScrollLeft,
  canScrollRight,
  onScrollLeft,
  onScrollRight,
}: CategoryCarouselArrowsProps) {
  return (
    <>
      <button
        type="button"
        aria-label="Categorías anteriores"
        disabled={!canScrollLeft}
        onClick={onScrollLeft}
        className="absolute left-md top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-control bg-negro/85 text-blanco opacity-0 transition-opacity duration-200 ease-out-strong hover:bg-negro-hover focus-visible:opacity-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-dorado group-hover/carousel:opacity-100 group-focus-within/carousel:opacity-100 disabled:pointer-events-none disabled:opacity-0"
      >
        <CaretLeft size={20} aria-hidden="true" />
      </button>

      <button
        type="button"
        aria-label="Siguientes categorías"
        disabled={!canScrollRight}
        onClick={onScrollRight}
        className="absolute right-md top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-control bg-negro/85 text-blanco opacity-0 transition-opacity duration-200 ease-out-strong hover:bg-negro-hover focus-visible:opacity-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-dorado group-hover/carousel:opacity-100 group-focus-within/carousel:opacity-100 disabled:pointer-events-none disabled:opacity-0"
      >
        <CaretRight size={20} aria-hidden="true" />
      </button>
    </>
  );
}
