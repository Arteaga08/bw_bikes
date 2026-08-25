import type { PublicHeroSlide } from "@bw-bikes/shared";
import Image from "next/image";

export interface HeroSlideContentProps {
  slide: PublicHeroSlide;
}

/**
 * The copy half of the hero column: eyebrow, title, subtitle. No positioning
 * of its own anymore — `HeroCarousel` owns the single bottom-left column this
 * block and `HeroControls` share, which is what finally makes the CTA, the
 * progress dashes and the arrow row line up on the same rail (the reference,
 * assos.com/int, aligns all three to the pixel).
 *
 * Only the active slide's copy is rendered, so there is no `aria-hidden`
 * bookkeeping here: nothing inactive exists in the DOM to hide.
 */
export function HeroSlideContent({ slide }: HeroSlideContentProps) {
  return (
    // `gap-sm` between eyebrow and title; the subtitle adds its own `mt-sm`
    // on top for the 16px the reference puts under the title.
    // `hero-in` reads `--hero-in-from` off the column wrapper, so the copy
    // enters from whichever side the carousel just travelled.
    <div className="flex flex-col gap-sm text-blanco motion-safe:animate-hero-in">
      {slide.eyebrow ? (
        // `text-eyebrow` carries the 11px/3px tracking of the token — the same
        // role this app uses everywhere else (`OrderDetailCard`, `MobileMenu`).
        <p className="flex items-center gap-xs font-ui text-eyebrow uppercase text-blanco/80">
          {/* 16x7, the asset's real 308:132 ratio — a square size logs a warning. */}
          <Image src="/brand/rhino-dorado.svg" alt="" width={16} height={7} aria-hidden="true" />
          {slide.eyebrow}
        </p>
      ) : null}

      {/* `font-extrabold` is load-bearing, not cosmetic: the `--text-h1`/`--text-h2`
          tokens in `globals.css` define size, line-height and letter-spacing but
          no `--text-*--font-weight`, so an `<h1>` was falling back to the browser's
          700 instead of the 800 `DESIGN.md` §3 specifies for the display voice.
          `leading-[1.05]` tightens the token's 1.08: uppercase has no descenders,
          so the extra room only loosens the block.
          `text-h2 sm:text-h1` (30/44px) and not `text-display` (64px) — 64px was
          the "texto muy grande" complaint from an earlier round, and 44px is what
          the reference actually measures at this viewport. */}
      <h1 className="text-balance font-display text-h2 font-extrabold uppercase leading-[1.05] text-blanco sm:text-h1">
        {slide.title}
      </h1>

      {slide.subtitle ? <p className="mt-sm font-body text-body-l text-blanco/70">{slide.subtitle}</p> : null}
    </div>
  );
}
