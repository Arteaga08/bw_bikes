import type { PublicHomeTile } from "@bw-bikes/shared";
import Image from "next/image";
import Link from "next/link";

export interface HomeCategoryCtaTileProps {
  tile: PublicHomeTile;
  label: string;
  href: string;
  corner: "left" | "right";
}

/**
 * One full-bleed photo tile: overlaid title, the whole card is one click
 * target. Overlaid text is `HeroSlideMedia`/`HeroSlideContent`'s grammar, not
 * `CategoryCard`'s (label below the photo) — these two tiles read as a
 * second, smaller hero row, not as catalog entries.
 */
export function HomeCategoryCtaTile({ tile, label, href, corner }: HomeCategoryCtaTileProps) {
  return (
    <Link
      href={href}
      className="group/tile relative block aspect-[5/4] shrink-0 basis-[92%] snap-start overflow-hidden rounded-card bg-inset sm:aspect-[3/2] sm:basis-[48%]"
    >
      <Image
        src={tile.image.url}
        alt={tile.image.alt ?? label}
        fill
        sizes="(max-width: 640px) 92vw, 48vw"
        loading="lazy"
        className="object-cover transition-transform duration-500 ease-out-strong motion-safe:group-hover/tile:scale-[1.03]"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-negro/80 via-negro/10 to-transparent" />

      <p className="absolute left-lg top-lg font-display text-h3 font-extrabold uppercase text-blanco sm:text-h2">{label}</p>

      <Image
        src="/brand/rhino-dorado.svg"
        alt=""
        width={24}
        height={24}
        aria-hidden="true"
        className={`absolute bottom-lg ${corner === "left" ? "left-lg" : "right-lg"}`}
      />
    </Link>
  );
}
