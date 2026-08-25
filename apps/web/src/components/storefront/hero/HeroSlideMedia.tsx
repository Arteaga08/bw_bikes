import type { HeroFocalPoint, PublicHeroSlide } from "@bw-bikes/shared";
import Image from "next/image";

const OBJECT_POSITION: Record<HeroFocalPoint, string> = {
  left: "left center",
  center: "center",
  right: "right center",
};

export interface HeroSlideMediaProps {
  slide: PublicHeroSlide;
  /** Only the first slide gets `priority`/eager loading — it's the LCP candidate; the rest would only compete with it for bandwidth. */
  isFirst: boolean;
}

/**
 * The full-bleed photo behind one slide, plus the bottom-up gradient that
 * gives the copy (`HeroSlideContent`) contrast over any photo — a light sky
 * and a dark forest both need to stay readable underneath the same title.
 */
export function HeroSlideMedia({ slide, isFirst }: HeroSlideMediaProps) {
  return (
    <div className="absolute inset-0">
      <Image
        src={slide.image.url}
        alt={slide.image.alt ?? ""}
        fill
        sizes="100vw"
        priority={isFirst}
        loading={isFirst ? undefined : "lazy"}
        className="object-cover"
        style={{ objectPosition: OBJECT_POSITION[slide.focalPoint] }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-negro/80 via-negro/20 to-transparent" />
    </div>
  );
}
