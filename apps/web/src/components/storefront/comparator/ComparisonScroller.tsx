"use client";

import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from "react";

export interface ComparisonScrollerProps {
  /** `ComparisonHeader` — pinned under the navbar, outside the scrollport. */
  header: ReactNode;
  /** The spec rows, inside the horizontally scrollable region. */
  children: ReactNode;
  /** Publishes `--comparison-columns` / `--comparison-columns-mobile` to both halves so they can't disagree on the column template. */
  style: CSSProperties;
}

/**
 * Splits the comparison into a pinned header and a horizontally scrollable
 * body, and keeps the two horizontally in sync.
 *
 * The header can't simply live inside the scrollport with `position: sticky`:
 * sticky anchors to the nearest scroll container *per axis*, and the
 * scrollport (`overflow-x: auto`, which the spec also promotes `overflow-y`
 * to a scrollport for) is that container on both axes — so a header inside it
 * pins to the table, not to the viewport, and scrolls off the top of the page
 * with everything else. That's why the header only stuck from `lg` up, where
 * scrolling is off entirely. CSS has no way out either: `overflow-x: auto`
 * forces a visible `overflow-y` to `auto`, and `overflow-x: clip` (the one
 * combination that keeps `overflow-y: visible`) can't scroll.
 *
 * So the header sits *outside* the scrollport, sticky against the viewport at
 * every width, and this component mirrors the body's `scrollLeft` onto it as a
 * transform. `overflow-hidden` on the header's own wrapper is what crops the
 * translated track — it's a scroll container the user can't drive, only the
 * body's scrollbar can.
 *
 * `scrollLeft` is read in the scroll handler and written straight to `style`
 * rather than through React state: this runs on every scroll frame, and a
 * re-render per frame would drop the header behind the body it's mirroring.
 * At `lg` the body stops scrolling, so `scrollLeft` is `0` and the transform
 * resolves to the identity — no `lg:` override needed, and no stale inline
 * transform left over from a phone-width resize.
 */
export function ComparisonScroller({ header, children, style }: ComparisonScrollerProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const headerTrackRef = useRef<HTMLDivElement>(null);

  const syncHeader = useCallback(() => {
    const body = bodyRef.current;
    const headerTrack = headerTrackRef.current;
    if (!body || !headerTrack) return;
    headerTrack.style.transform = `translateX(${-body.scrollLeft}px)`;
  }, []);

  // A reload can restore `scrollLeft` before any scroll event fires, which would leave the header offset from the body it heads.
  useEffect(() => syncHeader(), [syncHeader]);

  return (
    <div className="mt-xl" style={style}>
      <div className="sticky top-16 z-20 overflow-hidden bg-blanco lg:overflow-visible">
        <div ref={headerTrackRef} className="min-w-max will-change-transform lg:min-w-0">
          {header}
        </div>
      </div>

      <div
        ref={bodyRef}
        onScroll={syncHeader}
        className="overflow-x-auto overflow-y-hidden lg:overflow-visible"
      >
        {/*
         * `min-w-max` is what forces the overflow on a phone: a block-level child
         * defaults to filling its scrollable parent, which would shrink the fixed
         * mobile tracks instead of triggering the scrollbar. From `lg` up it's
         * dropped on both halves (`lg:min-w-0`) — the desktop template already
         * fits, and leaving it on would let header and body resolve *different*
         * max-content widths and fall out of column alignment.
         */}
        <div className="min-w-max lg:min-w-0">{children}</div>
      </div>
    </div>
  );
}
