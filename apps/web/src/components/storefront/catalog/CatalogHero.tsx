import Image from "next/image";

export interface CatalogHeroProps {
  image: { url: string; alt?: string };
  /** Short kicker above the title. Carries the page's single rhino. */
  eyebrow: string;
  title: string;
}

/**
 * The cover band at the top of every catalog page. Replicates
 * `HeroSlideMedia`/`HeroSlideContent`'s visual grammar without reusing them:
 * both are typed against `PublicHeroSlide`, the admin-managed home carousel's
 * contract, which a catalog cover has no business satisfying.
 *
 * A band (`clamp`ed to at most 26rem), not `min-h-svh` like the home hero.
 * This page's job is browsing, and a full-viewport cover would push the
 * categories, the filters and the first product row below the fold.
 *
 * The rhino here is the page's **second and last** appearance
 * (`DESIGN_SYSTEM.md` §5.1): the footer signature is the first. Nothing below
 * this band may add a third, which is why `CategoryCard` stays bare.
 */
export function CatalogHero({ image, eyebrow, title }: CatalogHeroProps) {
  return (
    <section className="relative isolate flex min-h-[clamp(17rem,38vh,26rem)] w-full items-end overflow-hidden bg-negro">
      <Image
        src={image.url}
        alt={image.alt ?? ""}
        fill
        sizes="100vw"
        priority
        className="object-cover"
      />

      {/* Both scrims from `HeroSlideMedia`: the bottom-up one alone leaves the
          title fighting whatever the photo puts on the left, which is where
          the copy sits. Together they hold the text at AA over a bright frame. */}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-negro/80 via-negro/20 to-transparent" />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-negro/70 via-negro/10 to-transparent" />

      {/* Same inset as `ScrollRail`'s `page` gutter, so the first category tile
          below lands on exactly the same left edge as this title. */}
      <div className="relative flex flex-col gap-sm px-lg pb-xl sm:pb-2xl sm:pl-[clamp(2rem,8vw,8rem)] sm:pr-xl">
        <p className="flex items-center gap-xs font-ui text-eyebrow uppercase text-blanco/80">
          {/* 16x7 is the asset's real 308:132 ratio; a square size logs a warning. */}
          <Image src="/brand/rhino-dorado.svg" alt="" width={16} height={7} aria-hidden="true" />
          {eyebrow}
        </p>

        <h1 className="text-balance font-display text-h2 font-extrabold uppercase leading-[1.05] text-blanco sm:text-h1">
          {title}
        </h1>
      </div>
    </section>
  );
}
