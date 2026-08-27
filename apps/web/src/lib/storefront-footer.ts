export interface FooterLinkColumnData {
  heading: string;
  links: readonly { label: string; href: string }[];
}

/**
 * The footer's two editorial columns — "Tienda" reuses `STOREFRONT_NAV_ITEMS`
 * directly in `Footer.tsx` instead of duplicating it here.
 *
 * Every route below 404s today, same as `Bicicletas`/`Accesorios`/`Ofertas`
 * in `storefront-nav.ts`: these are the seven content pages
 * `DESIGN_SYSTEM.md` §5.1 already named (Nosotros, Compromiso,
 * Distribuidores, Garantía, Envíos, Tallas, Contacto) as the site's planned
 * pages, none of which exist yet. The footer links to where they'll live,
 * not to a dead end invented for this entrega.
 */
export const FOOTER_LINK_COLUMNS: readonly FooterLinkColumnData[] = [
  {
    heading: "Sobre B/W",
    links: [
      { label: "Nosotros", href: "/nosotros" },
      { label: "Compromiso", href: "/compromiso" },
      { label: "Distribuidores", href: "/distribuidores" },
    ],
  },
  {
    heading: "Ayuda",
    links: [
      { label: "Garantía", href: "/garantia" },
      { label: "Envíos", href: "/envios" },
      { label: "Guía de tallas", href: "/tallas" },
      { label: "Contacto", href: "/contacto" },
    ],
  },
];
