import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export interface PhotoCtaTileProps {
  image: { url: string; alt?: string };
  label: string;
  href: string;
  /**
   * `true` when `href` leaves the app. A `next/link` would prefetch a
   * third-party origin, so external destinations get a plain `<a>` with
   * `target="_blank"` + `rel="noopener noreferrer"` — same criterion already
   * documented in `SocialButton` and `MobileMenu`'s WhatsApp CTA.
   */
  external?: boolean;
  /**
   * Which corner carries the rhino. Omitted means no rhino — a home section
   * added after the two allowed appearances (`DESIGN_SYSTEM.md` §5.1) has to
   * stay out of the count.
   */
  rhinoCorner?: "left" | "right";
}

/**
 * One full-bleed photo tile: overlaid title, the whole card is one click
 * target. Overlaid text is `HeroSlideMedia`/`HeroSlideContent`'s grammar, not
 * `CategoryCard`'s (label below the photo) — a row of these reads as a second,
 * smaller hero row, not as catalog entries.
 *
 * Shared by `HomeCategoryCtaTile` (admin-managed photos, internal catalog
 * destinations) and `HomeBranchCtas` (fixed photos, external destinations),
 * the same way `ScrollRail` is shared by the three carousels: this owns the
 * design, the callers own their data and their Spanish copy.
 *
 * Every tile sizes itself for `ScrollRail`'s track (`shrink-0 basis-*
 * snap-start`), which is the contract that component documents for its
 * children.
 */
export function PhotoCtaTile({ image, label, href, external = false, rhinoCorner }: PhotoCtaTileProps) {
  const className =
    "group/tile relative block aspect-[5/4] shrink-0 basis-[92%] snap-start overflow-hidden rounded-card bg-inset sm:aspect-[3/2] sm:basis-[calc(50%-12px)]";

  const content: ReactNode = (
    <>
      <Image
        src={image.url}
        alt={image.alt ?? label}
        fill
        sizes="(max-width: 640px) 92vw, 50vw"
        loading="lazy"
        className="object-cover transition-transform duration-500 ease-out-strong motion-safe:group-hover/tile:scale-[1.03]"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-negro/80 via-negro/10 to-transparent" />

      <p className="absolute left-lg top-lg font-display text-h3 font-extrabold uppercase text-blanco sm:text-h2">{label}</p>

      {rhinoCorner ? (
        <Image
          src="/brand/rhino-dorado.svg"
          alt=""
          width={24}
          height={24}
          aria-hidden="true"
          className={`absolute bottom-lg ${rhinoCorner === "left" ? "left-lg" : "right-lg"}`}
        />
      ) : null}
    </>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}
