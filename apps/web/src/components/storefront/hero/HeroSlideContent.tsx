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
      className="absolute inset-x-0 bottom-0 flex flex-col gap-md p-lg pb-3xl text-blanco sm:max-w-2xl sm:p-2xl sm:pb-3xl"
    >
      {slide.eyebrow ? (
        <p className="flex items-center gap-xs font-ui text-ui uppercase tracking-wide text-blanco/80">
          <Image src="/brand/rhino-dorado.svg" alt="" width={16} height={16} aria-hidden="true" />
          {slide.eyebrow}
        </p>
      ) : null}

      <h1 className="font-display text-h1 text-blanco sm:text-display">{slide.title}</h1>

      {slide.subtitle ? <p className="font-body text-body-l text-blanco/80">{slide.subtitle}</p> : null}

      <div className="mt-sm flex flex-wrap gap-sm">
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
