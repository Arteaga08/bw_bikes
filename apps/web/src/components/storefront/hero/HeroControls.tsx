import type { PublicHeroSlideCta } from "@bw-bikes/shared";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/ssr";
import { ButtonLink } from "@/components/ui/ButtonLink";

export interface HeroControlsProps {
  ctas: PublicHeroSlideCta[];
  total: number;
  activeIndex: number;
  onSelect: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * The hero's action rail: CTAs on top, then the progress dashes, then the
 * counter centred between the two arrows. All three rows share one fixed
 * width (`sm:w-[24rem]`), which is the whole point — in the reference
 * (assos.com/int) the button, the dash strip and the arrow row start and end
 * on exactly the same pixel, and that shared edge is what reads as a grid.
 * The copy above may overflow the rail; the reference's own eyebrow does.
 *
 * The CTAs live here rather than in `HeroSlideContent` because they belong to
 * the rail, not to the copy. That also means this component renders for a
 * single-slide hero too (it would otherwise take the CTAs down with it); only
 * the dashes and arrows are gated on there being something to navigate to.
 */
export function HeroControls({ ctas, total, activeIndex, onSelect, onPrev, onNext }: HeroControlsProps) {
  return (
    <div className="mt-xl flex w-full flex-col gap-md text-blanco sm:w-[24rem]">
      {/* Grid, not flex with `flex-1` on each button: grid items stretch on
          their own (`justify-items: stretch`), so no width class ever touches
          `ButtonLink`. That sidesteps the trap in `DESIGN.md` §6 — without
          `tailwind-merge`, a `w-*` passed through `className` loses to the
          component's own class by CSS order, silently. One CTA fills the rail;
          two split it, same as the reference's "SHOP MEN"/"SHOP WOMEN" slide.
          Keyed on `activeIndex` so the labels animate in with the copy. */}
      <div key={activeIndex} className="grid auto-cols-fr grid-flow-col gap-sm motion-safe:animate-hero-in">
        {ctas.map((cta) => (
          <ButtonLink key={cta.href} href={cta.href} variant="ghost" tone="inverse" size="md">
            {cta.label}
          </ButtonLink>
        ))}
      </div>

      {total > 1 ? (
        <>
          <div className="grid auto-cols-fr grid-flow-col gap-xs" role="group" aria-label="Ir a un slide">
            {Array.from({ length: total }, (_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Slide ${index + 1} de ${total}`}
                aria-current={index === activeIndex}
                onClick={() => onSelect(index)}
                className="h-[2px] rounded-full bg-blanco/30 transition-colors focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-dorado aria-[current=true]:bg-dorado"
              />
            ))}
          </div>

          {/* `-ml-sm`/`-mr-sm` pull the 32px arrow buttons out by 8px so their
              20px glyphs sit flush with the rail's edges instead of 6px inside
              it. Without this the carets visibly break the shared left edge the
              CTA and the dashes establish. */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Slide anterior"
              onClick={onPrev}
              className="-ml-sm flex h-8 w-8 items-center justify-center rounded-control text-blanco/70 transition-colors hover:text-dorado focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-dorado"
            >
              <CaretLeft size={20} aria-hidden="true" />
            </button>

            {/* `tabular-nums` so the row doesn't shift when the index goes from
                `9 | 12` to `10 | 12`. */}
            <p className="font-ui text-ui tabular-nums text-blanco/60" aria-hidden="true">
              {activeIndex + 1} | {total}
            </p>

            <button
              type="button"
              aria-label="Siguiente slide"
              onClick={onNext}
              className="-mr-sm flex h-8 w-8 items-center justify-center rounded-control text-blanco/70 transition-colors hover:text-dorado focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-dorado"
            >
              <CaretRight size={20} aria-hidden="true" />
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
