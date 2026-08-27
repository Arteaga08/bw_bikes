import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { cn } from "@/lib/cn";
import type { MegaMenuContent } from "@/lib/storefront-mega-menu";

export interface NavMegaMenuPanelProps {
  content: MegaMenuContent;
  onNavigate?: () => void;
}

function RhinoMark({ corner }: { corner: "left" | "right" }) {
  return (
    <Image
      src="/brand/rhino-dorado.svg"
      alt=""
      width={22}
      height={10}
      aria-hidden="true"
      className={cn("absolute bottom-md", corner === "left" ? "left-md" : "right-md")}
    />
  );
}

function SectionList({ section, onNavigate }: { section: MegaMenuContent["sections"][number]; onNavigate?: () => void }) {
  return (
    <div>
      {section.title ? <p className="mb-md text-eyebrow uppercase text-grafito">{section.title}</p> : null}
      <ul className="flex flex-col gap-sm">
        {section.items.map((item) => (
          <li key={item.id}>
            <ButtonLink href={item.href} variant="text" tone="neutral" onClick={onNavigate}>
              <span className="text-body-l">{item.name}</span>
            </ButtonLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Desktop mega-menu panel — editorial split: text columns on the left, a
 * large photo tile on the right, edge-to-edge under the navbar. Shared by
 * Bicicletas, Accesorios and Ofertas off the same `MegaMenuContent`
 * (`lib/storefront-mega-menu.ts`); each caller's `sections`/`eyebrow` decide
 * how full the left column reads, this component never branches on *which*
 * nav item it's rendering.
 *
 * Empty sections (a catalog fetch that came back with no items, e.g.
 * "Comprar por marca" when `brands` failed to load) are dropped before
 * render — an orphaned section title over an empty list is worse than not
 * showing that section at all.
 */
export function NavMegaMenuPanel({ content, onNavigate }: NavMegaMenuPanelProps) {
  const sections = content.sections.filter((section) => section.items.length > 0);
  const hasSections = sections.length > 0;

  return (
    <div className="fixed inset-x-0 top-16 border-b border-borde bg-surface">
      <div className="grid gap-2xl px-lg py-xl lg:grid-cols-[1fr_360px] lg:px-3xl">
        {hasSections ? (
          <div className="grid gap-xl sm:grid-cols-2">
            {sections.map((section, index) => (
              <div key={section.title ?? index} className={cn(index > 0 && "sm:border-l sm:border-borde sm:pl-xl")}>
                <SectionList section={section} onNavigate={onNavigate} />
              </div>
            ))}
          </div>
        ) : (
          // No category tree for this item (Ofertas never has one) — the
          // column carries its own visual weight instead of sitting empty:
          // same eyebrow grammar as a section title, then the CTA copy set
          // large, then a primary (dorado) button. The one dorado surface in
          // this view, so it stays within the One Accent Rule.
          <div className="flex flex-col justify-center gap-md">
            {content.eyebrow ? <p className="text-eyebrow uppercase text-grafito">{content.eyebrow}</p> : null}
            <p className="font-display text-h1 font-extrabold uppercase leading-none text-negro">{content.ctaLabel}</p>
            <ButtonLink href={content.ctaHref} variant="primary" onClick={onNavigate} className="w-fit">
              Ver rebajas
            </ButtonLink>
          </div>
        )}

        <Link
          href={content.ctaHref}
          onClick={onNavigate}
          className={cn(
            "group/photo relative block overflow-hidden rounded-card-lg bg-inset",
            hasSections ? "aspect-[4/3]" : "aspect-[16/9]",
          )}
        >
          <Image
            src={content.photo.url}
            alt=""
            fill
            sizes="360px"
            className="object-cover transition-transform duration-500 ease-out-strong motion-safe:group-hover/photo:scale-[1.03]"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-negro/70 via-negro/10 to-transparent" />
          <p className="absolute left-md top-md font-display text-h3 font-extrabold uppercase text-blanco">{content.ctaLabel}</p>
          {content.photo.rhinoCorner ? <RhinoMark corner={content.photo.rhinoCorner} /> : null}
        </Link>
      </div>

      {hasSections ? (
        <div className="border-t border-borde px-lg py-md lg:px-3xl">
          <ButtonLink href={content.ctaHref} variant="text" tone="neutral" onClick={onNavigate}>
            <span className="text-h3">{content.ctaLabel}</span>
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}
