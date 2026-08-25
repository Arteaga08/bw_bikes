import type { PublicHeroSlide } from "@bw-bikes/shared";
import Image from "next/image";
import { ButtonLink } from "@/components/ui/ButtonLink";

export interface HeroSlideContentProps {
  slide: PublicHeroSlide;
  isActive: boolean;
}

/**
 * The copy block: eyebrow (with the gold rhino DESIGN_SYSTEM.md §5.2 asks
 * for on the home hero), title, subtitle, and CTAs — bottom-left, matching
 * the reference (assos.com/int).
 *
 * `ButtonLink variant="ghost" tone="inverse"` is already the white outline
 * button with a gold hover the reference shows — no new `Button` variant
 * needed, see the plan's note on `cn`'s no-tailwind-merge trap.
 *
 * `aria-hidden` on inactive slides — `HeroCarousel` keeps every slide
 * mounted for the crossfade, so only the active one's links and heading
 * should be reachable by keyboard or a screen reader.
 */
export function HeroSlideContent({ slide, isActive }: HeroSlideContentProps) {
  return (
    <div
      aria-hidden={!isActive}
      // `max-w-[42rem]`, not `max-w-2xl` — Tailwind v4 resolves `max-w-{key}`
      // against `--spacing-{key}` before its own `--container-{key}` default
      // (see the warning in `globals.css`), so `max-w-2xl` collided with
      // `--spacing-2xl: 48px` and capped this block at 48px wide, wrapping
      // every word onto its own line. An arbitrary value sidesteps the
      // namespace entirely, same as `max-w-[65ch]`/`max-w-[480px]` elsewhere.
      // `pb-2xl`/`sm:pb-[6rem]`, not the earlier `pb-xl`/`sm:pb-2xl` — leaves
      // room for `HeroControls`' dashes/arrows to stack directly below the
      // CTA row (same left inset) without overlapping it, and lifts the
      // whole block to roughly the reference's vertical position instead of
      // sitting right at the screen edge.
      className="absolute inset-x-0 bottom-0 flex flex-col gap-xs p-lg pb-2xl text-blanco sm:max-w-[42rem] sm:p-xl sm:pb-[6rem]"
    >
      {slide.eyebrow ? (
        // `text-eyebrow` (11px, 3px letter-spacing baked into the token),
        // not `text-ui uppercase tracking-wide` — this is exactly the
        // purpose-built token for this role, already the convention
        // everywhere else in the app (`OrderDetailCard`, `MobileMenu`,
        // `StatCard`, the admin login screen) and it was a miss to hand-roll
        // an equivalent here instead of using it.
        <p className="flex items-center gap-xs font-ui text-eyebrow uppercase text-blanco/80">
          {/* 16x7, not a 16x16 square — matches the asset's real 308:132 aspect ratio (same ratio `MobileMenu.tsx` already uses for this icon); a mismatched size is what produced the console warning. */}
          <Image src="/brand/rhino-dorado.svg" alt="" width={16} height={7} aria-hidden="true" />
          {slide.eyebrow}
        </p>
      ) : null}

      {/* `text-h2 sm:text-h1`, not `text-h1 sm:text-display` — the reference's
          title reads proportional to its eyebrow, not a `text-display`-scale
          jump; 64px next to an 11px eyebrow was the actual "texto muy
          grande" complaint. */}
      <h1 className="font-display text-h2 text-blanco sm:text-h1">{slide.title}</h1>

      {slide.subtitle ? <p className="font-body text-body-l text-blanco/80">{slide.subtitle}</p> : null}

      <div className="mt-xs flex flex-wrap gap-sm">
        {/* No width override per CTA count — every button keeps `size="md"`'s
            natural padding regardless of whether the slide has one or two.
            The reference's own single-CTA slide ("SHOP MEN" alone) and its
            two-CTA slide ("SHOP MEN"/"SHOP WOMEN") render each button at the
            *same* individual size; a previous round here stretched a lone
            CTA to `w-full` to "cover two buttons' worth of space", which
            just made it inconsistent with the two-CTA case instead. */}
        {slide.ctas.map((cta) => (
          <ButtonLink
            key={cta.href}
            href={cta.href}
            variant="ghost"
            tone="inverse"
            size="md"
            tabIndex={isActive ? undefined : -1}
          >
            {cta.label}
          </ButtonLink>
        ))}
      </div>
    </div>
  );
}
