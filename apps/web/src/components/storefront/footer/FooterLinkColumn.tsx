import { ButtonLink } from "@/components/ui/ButtonLink";

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
 */
export function FooterLinkColumn({ heading, links }: FooterLinkColumnProps) {
  return (
    <div className="flex flex-col gap-md">
      <h3 className="font-ui text-eyebrow uppercase text-blanco/50">{heading}</h3>
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
  );
}
