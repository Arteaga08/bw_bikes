import type { PublicCategoryTreeNode } from "@bw-bikes/shared";
import Image from "next/image";
import Link from "next/link";

export interface CategoryCardProps {
  category: PublicCategoryTreeNode;
}

/**
 * One tile in the category rail: photo, then the name below it in flow (not
 * overlaid on the image — that's the hero's grammar, this section reads as a
 * catalog, not a second hero). Server-safe: it only ever renders inside
 * `CategoryCarousel`'s client boundary, never opens one of its own.
 *
 * `HomeCategories` already filters out any category without an `image`, so
 * this component can assume `category.image` exists rather than branching on
 * it here.
 */
export function CategoryCard({ category }: CategoryCardProps) {
  const image = category.image;
  if (!image) return null;

  return (
    <Link
      href={`/bicicletas/${category.slug}`}
      className="group/card shrink-0 basis-[78%] snap-start sm:basis-[46%] lg:basis-[31%] xl:basis-[22%]"
    >
      {/* `bg-inset`, not `bg-surface` — this frame only shows while the image
          decodes, and the system reserves `inset` for exactly that kind of
          recessed placeholder (`DESIGN.md` §4). */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-card bg-inset">
        <Image
          src={image.url}
          alt={image.alt ?? category.name}
          fill
          sizes="(max-width: 640px) 78vw, (max-width: 1024px) 46vw, 23vw"
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
          once. */}
      <p className="relative mt-md inline-block font-display text-h3 text-negro">
        {category.name}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 -bottom-1 h-px origin-center scale-x-0 bg-dorado transition-transform duration-150 group-hover/card:scale-x-100"
        />
      </p>
    </Link>
  );
}
