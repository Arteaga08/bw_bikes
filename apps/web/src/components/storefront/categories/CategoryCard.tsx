import type { PublicCategoryTreeNode } from "@bw-bikes/shared";
import Image from "next/image";
import Link from "next/link";

/**
 * `default` is the home rail's tile. `compact` is the catalog header's: same
 * card, narrower and shorter, because there it sits under a cover band as
 * navigation rather than being the section's own content.
 */
export type CategoryCardSize = "default" | "compact";

export interface CategoryCardProps {
  category: PublicCategoryTreeNode;
  /** Catalog this category belongs to. Defaults to the bike catalog. */
  basePath?: string;
  size?: CategoryCardSize;
  /** Marks the category whose page is currently open. */
  isActive?: boolean;
}

const SIZE_CLASSNAMES: Record<CategoryCardSize, { tile: string; frame: string; name: string; sizes: string }> = {
  default: {
    tile: "basis-[78%] sm:basis-[46%] lg:basis-[31%] xl:basis-[22%]",
    frame: "aspect-[4/5]",
    name: "text-h3",
    sizes: "(max-width: 640px) 78vw, (max-width: 1024px) 46vw, 23vw",
  },
  compact: {
    tile: "basis-[62%] sm:basis-[38%] lg:basis-[26%] xl:basis-[19%]",
    frame: "aspect-[3/4]",
    name: "text-body-l",
    sizes: "(max-width: 640px) 62vw, (max-width: 1024px) 38vw, 19vw",
  },
};

/**
 * One tile in a category rail: photo, then the name below it in flow (not
 * overlaid on the image — that's the hero's grammar, a rail reads as a
 * catalog, not a second hero). Server-safe: it only ever renders inside a
 * caller's client boundary, never opens one of its own.
 *
 * Callers filter out categories without an `image` before rendering, so this
 * component can assume `category.image` exists rather than branching on it.
 *
 * No rhino here, at either size. A row of four tiles would blow the two-per-
 * view budget in `DESIGN_SYSTEM.md` §5.1 on its own.
 */
export function CategoryCard({
  category,
  basePath = "/bicicletas",
  size = "default",
  isActive = false,
}: CategoryCardProps) {
  const image = category.image;
  if (!image) return null;

  const style = SIZE_CLASSNAMES[size];

  return (
    <Link
      href={`${basePath}/${category.slug}`}
      aria-current={isActive ? "page" : undefined}
      className={`group/card shrink-0 snap-start ${style.tile}`}
    >
      {/* `bg-inset`, not `bg-surface` — this frame only shows while the image
          decodes, and the system reserves `inset` for exactly that kind of
          recessed placeholder (`DESIGN.md` §4). */}
      <div className={`relative overflow-hidden rounded-card bg-inset ${style.frame}`}>
        <Image
          src={image.url}
          alt={image.alt ?? category.name}
          fill
          sizes={style.sizes}
          loading="lazy"
          // Transform only, never a layout property — the shared motion rule.
          // `duration-500 ease-out-strong` matches the hero's own photo pacing
          // so the two sections don't feel like they're running different
          // clocks.
          className="object-cover transition-transform duration-500 ease-out-strong motion-safe:group-hover/card:scale-[1.03]"
        />
      </div>

      {/* Same underline-grows-from-center gesture as `Button`'s `text` variant
          (`ButtonContent` in `components/ui/Button.tsx`) — reused by hand
          here because a category name isn't a button. Manuel's call: the
          dorado lives only in the underline; the name itself stays `negro` on
          hover so the accent doesn't spend itself on five tiles of text at
          once. The open category holds that underline instead of waiting for
          hover, which is the whole marker: no second colour, no extra chrome.
          `bottom-0`, not `-bottom-1` — this rail sits inside `ScrollRail`'s
          track, which needs `overflow-y-hidden` (see that component's own
          doc comment) to keep the desktop mouse wheel from getting trapped.
          A negative offset pushes the line past the flex item's own bottom
          edge, and the track clips it there: confirmed on screen, the line
          was rendering with the right color, width and position and was
          still fully invisible. `bottom-0` keeps it inside the `<p>`'s own
          box, same anchor `ButtonContent` already uses. `h-0.5` (2px), not
          `h-px`: same 2px weight `MenuToggleIcon`'s bars and `HeroControls`'
          progress dashes use for a hairline that has to actually read as a
          line, not anti-alias away at a sub-pixel position. */}
      <p className={`relative mt-md inline-block font-display text-negro ${style.name}`}>
        {category.name}
        <span
          aria-hidden="true"
          className={`absolute inset-x-0 bottom-0 h-0.5 origin-center bg-dorado transition-transform duration-150 group-hover/card:scale-x-100 ${
            isActive ? "scale-x-100" : "scale-x-0"
          }`}
        />
      </p>
    </Link>
  );
}
