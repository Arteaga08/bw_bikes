export interface ScrollRailProgressProps {
  /** Fraction of the track already scrolled past, 0–1. */
  scrollRatio: number;
  /** Fraction of the track's total width the viewport shows at once, 0–1. */
  visibleRatio: number;
}

/**
 * Mobile-only scroll indicator — Manuel's call after seeing the mobile
 * screenshot: on touch there's no hover, so `ScrollRailArrows` never
 * appears and a shopper has no visual cue this row scrolls. `sm:hidden`
 * because from `sm` up the arrows already do that job on hover/focus; two
 * indicators for the same thing would be redundant chrome.
 *
 * Same dorado-on-track shape as the hero's progress dashes
 * (`HeroControls.tsx`), scaled down to one continuous thumb instead of one
 * dash per slide — there's no discrete "slide index" here, just a scroll
 * position.
 */
export function ScrollRailProgress({ scrollRatio, visibleRatio }: ScrollRailProgressProps) {
  if (visibleRatio >= 1) return null;

  // The thumb's own width is `visibleRatio` of the track; a translateX
  // expressed as a percentage is relative to the thumb's own box, not the
  // track, so it has to be rescaled by `1 / visibleRatio` to land the thumb
  // at the track's true edges instead of undershooting them.
  const thumbWidthPercent = visibleRatio * 100;
  const maxTranslatePercent = 100 / visibleRatio - 100;

  return (
    <div aria-hidden="true" className="mt-md px-lg sm:hidden">
      <div className="relative h-[3px] overflow-hidden rounded-full bg-negro/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-dorado"
          style={{
            width: `${thumbWidthPercent}%`,
            transform: `translateX(${scrollRatio * maxTranslatePercent}%)`,
          }}
        />
      </div>
    </div>
  );
}
