"use client";

import { usePathname } from "next/navigation";
import { ButtonLink } from "@/components/ui/ButtonLink";
import type { ButtonTone } from "@/components/ui/Button";
import { isStorefrontNavItemActive, STOREFRONT_NAV_ITEMS } from "@/lib/storefront-nav";

export interface StorefrontNavLinksProps {
  /** Follows the navbar's own transparent/solid state — `inverse` over the hero, `neutral` once scrolled. */
  tone: ButtonTone;
}

/**
 * The desktop nav list (`md:` up). Renders each destination as
 * `ButtonLink variant="text"` — the grow-from-center underline `DESIGN.md`
 * §5 already specifies for inline navigation — instead of a hand-styled
 * `<Link>`. That was the actual bug the previous version shipped with: the
 * underline existed in the design system the whole time, this component
 * just wasn't using it (`DESIGN.md` §6: "Do usar `ButtonLink`… nunca
 * `<Link>` con estilo a mano").
 *
 * `active` (not just `aria-current`) pins the underline at full width for
 * the current section — `text`'s underline is otherwise hover-only, and a
 * nav with no "you are here" signal is incomplete per the same doc's
 * six-states rule.
 *
 * The label is wrapped in its own `text-h3` span rather than sized via
 * `ButtonLink`'s own `className` — `text`'s base classes already set
 * `text-ui` (13px) on the `<a>` itself, and a second, unprefixed font-size
 * utility on that *same* element would be two same-specificity rules
 * fighting over one property (the `max-md:hidden` bug from the last round —
 * see `lib/cn.ts`). A size set on a *child* element instead just overrides
 * the inherited value, no race.
 */
export function StorefrontNavLinks({ tone }: StorefrontNavLinksProps) {
  const pathname = usePathname();

  return (
    <ul className="flex items-center gap-xl">
      {STOREFRONT_NAV_ITEMS.map((item) => {
        const isActive = isStorefrontNavItemActive(pathname, item.href);
        return (
          <li key={item.href}>
            <ButtonLink href={item.href} variant="text" tone={tone} active={isActive} aria-current={isActive ? "page" : undefined}>
              <span className="text-h3">{item.label}</span>
            </ButtonLink>
          </li>
        );
      })}
    </ul>
  );
}
