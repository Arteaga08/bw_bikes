"use client";

import { Plus } from "@phosphor-icons/react";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/cn";

export interface FooterLinkColumnProps {
  heading: string;
  links: readonly { label: string; href: string }[];
}

/**
 * One labelled stack of destinations — reused for "Tienda" (the primary nav's
 * own three items, `STOREFRONT_NAV_ITEMS`) and the two editorial columns from
 * `storefront-footer.ts`. `ButtonLink variant="text" tone="inverse"` is the
 * same control `SocialButton` already defaults to for this surface — the
 * center-grown gold underline, not a hand-styled `<Link>` (`DESIGN_SYSTEM.md`
 * §4.6: never `<Link>` with hand-rolled classes where a `text` button exists).
 *
 * Below `sm` (639px — the same cut where `Footer.tsx`'s grid goes from 1 to 2
 * columns) this collapses into an accordion, closed by default: three
 * always-expanded lists stacked on a narrow viewport read as one long,
 * disordered scroll (the steadyrack.com reference this was modeled on keeps
 * every section collapsed until tapped). At `sm:` and up `expanded` is
 * pinned `true` regardless of `open`, so the heading stays the plain `<h3>`
 * from before and the panel never collapses — desktop/tablet is unchanged.
 *
 * Collapse mechanics copy `NavAccordionItem`'s established pattern:
 * `grid-template-rows` `0fr`/`1fr` (not `height`) so the panel animates to
 * its natural height without measuring in JS, and `inert` while collapsed so
 * Tab skips the hidden links without unmounting them. The icon differs —
 * `Plus` rotating 45° into an `×`, not `NavAccordionItem`'s `CaretDown` —
 * matching the reference; same "rotate one glyph, don't swap two" reasoning
 * `MenuToggleIcon` documents.
 */
export function FooterLinkColumn({ heading, links }: FooterLinkColumnProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 639px)");
  const expanded = isMobile ? open : true;
  const panelId = `footer-${heading.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="flex flex-col gap-md">
      {isMobile ? (
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex w-full items-center justify-between gap-sm text-left"
        >
          <span className="font-ui text-eyebrow uppercase text-blanco/50">{heading}</span>
          <Plus
            aria-hidden="true"
            size={16}
            className={cn("shrink-0 text-blanco/50 transition-transform duration-200 ease-out-strong", expanded && "rotate-45")}
          />
        </button>
      ) : (
        <h3 className="font-ui text-eyebrow uppercase text-blanco/50">{heading}</h3>
      )}

      <div
        id={panelId}
        inert={!expanded ? true : undefined}
        className="grid transition-[grid-template-rows] duration-200 ease-out-strong"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <ul className="flex flex-col gap-sm">
            {links.map((link) => (
              <li key={link.href}>
                <ButtonLink href={link.href} variant="text" tone="inverse">
                  {link.label}
                </ButtonLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
