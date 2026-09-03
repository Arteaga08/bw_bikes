import Image from "next/image";
import { Wordmark } from "@/components/storefront/Wordmark";
import { SocialButton } from "@/components/ui/SocialButton";
import { BRAND_SOCIAL_LINKS } from "@/lib/brand-social";
import { FOOTER_LINK_COLUMNS } from "@/lib/storefront-footer";
import { STOREFRONT_NAV_ITEMS } from "@/lib/storefront-nav";
import { FooterLinkColumn } from "./FooterLinkColumn";

/**
 * The storefront's closing chrome (M12, entrega 10/10 — the last section
 * `docs/MILESTONES.md` names in the home's build order). Lives in
 * `(storefront)/layout.tsx`, not `page.tsx`: `DESIGN_SYSTEM.md` §5.1 calls
 * the footer "global — vive en casi todas las páginas del sitio", the same
 * chrome tier as `Navbar`, not a home-page-only section.
 *
 * `overlay` (#0A0A0A) is the surface — the storefront's other dark ground
 * besides the navbar/modals — so every control on it takes `tone="inverse"`:
 * `SocialButton` already defaults there, `FooterLinkColumn` passes it
 * explicitly to `ButtonLink`.
 *
 * "Tienda" reuses `STOREFRONT_NAV_ITEMS` (the navbar's own three links)
 * instead of a duplicate list — the same destinations, a second entry point.
 *
 * The headline reuses `HeroSlideContent`'s own display voice
 * (`font-display font-extrabold uppercase`), but not its token sizes: the
 * brand name has to stay on one line and span edge-to-edge at every width
 * (Manuel's call, matching the steadyrack.com reference), which the fixed
 * `text-h2/h1/display` steps can't guarantee — a step boundary would still
 * wrap or under-fill between breakpoints. The `vw`-driven size in the
 * `clamp()` is tuned to this exact 22-character string so the rendered line
 * lands close to the container width at any viewport — the same "no loose
 * values unless the token scale genuinely can't cover it" exception
 * `PromoBanner`'s `max-w-[34rem]` already documents.
 */
export function Footer() {
  return (
    <footer className="bg-overlay">
      <div className="overflow-hidden px-md pt-xl text-center">
        <h2 className="whitespace-nowrap font-display text-[clamp(1.5rem,7.5vw,10rem)] font-extrabold uppercase leading-[1.05] text-blanco">
          Black and White Bikes
        </h2>
      </div>

      {/* `pb-[6rem]`, not the `pt-3xl` this shares its top with: Manuel wants
          more black specifically between the link columns and the
          rhino/copyright line below — the scale's `3xl` (64px) read as too
          tight there, same arbitrary-value exception as `pt-[6rem]` above. */}
      <div className="grid grid-cols-1 gap-2xl px-lg pt-3xl pb-[6rem] sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-md">
          <Wordmark tone="inverse" />
          {/* `max-w-[20rem]`, never `max-w-xs`: Tailwind v4 resolves `max-w-{key}`
              against `--spacing-{key}` (`xs` = 4px) before its own
              `--container-{key}` — see the warning in `globals.css` and
              `PromoBanner.tsx`'s own `max-w-[34rem]`. */}
          <p className="max-w-[20rem] font-body text-body text-blanco/60">
            Bicicletas y accesorios para quienes no se detienen. Asesoría real, en tienda y en línea.
          </p>
          <ul className="flex items-center gap-sm">
            {BRAND_SOCIAL_LINKS.map((link) => (
              <li key={link.network}>
                <SocialButton network={link.network} href={link.href} />
              </li>
            ))}
          </ul>
        </div>

        <FooterLinkColumn heading="Tienda" links={STOREFRONT_NAV_ITEMS} />
        {FOOTER_LINK_COLUMNS.map((column) => (
          <FooterLinkColumn key={column.heading} heading={column.heading} links={column.links} />
        ))}
      </div>

      <div className="border-t border-blanco/10 px-lg py-xl">
        {/* Firma de footer (global) — DESIGN_SYSTEM.md §5.2: rhino-dorado.svg a
            12px de alto (28×12, la relación real 308:132 del asset), inline e
            inmediatamente antes del copyright, mismo baseline, alineado a la
            izquierda del bloque. Es la aparición base del rinoceronte en
            cualquier pantalla donde este footer viva. */}
        <p className="flex items-center gap-sm font-ui text-caption text-blanco/50">
          <Image src="/brand/rhino-dorado.svg" alt="" width={28} height={12} aria-hidden="true" />
          {`© ${new Date().getFullYear()} Black and White Bikes. Todos los derechos reservados.`}
        </p>
      </div>
    </footer>
  );
}
