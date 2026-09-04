import type { UserRole } from "@bw-bikes/shared";
import type { Icon } from "@phosphor-icons/react";
import {
  Bicycle,
  ChartBar,
  ClipboardText,
  ClockCounterClockwise,
  Gear,
  Handshake,
  House,
  Image,
  ListChecks,
  Package,
  Ruler,
  Sparkle,
  Storefront,
  Swatches,
  Tag,
  Ticket,
  UsersThree,
} from "@phosphor-icons/react";

export interface NavItem {
  label: string;
  href: string;
  icon: Icon;
  keywords: readonly string[];
  /** Absent means every admin role sees it. Present restricts it to exactly those roles — M11's audit viewer is the first item to use this. */
  roles?: readonly UserRole[];
}

export interface NavSection {
  title: string;
  items: readonly NavItem[];
}

/**
 * The ten real destinations of phase 2, grouped by domain (M10.1's own
 * reorganization of M8's flat list, per the Casa de Cristal reference Manuel
 * shared): OPERACIÓN for daily work, one section per catalog (each with its
 * own category tree next to its own products — the exact thing M10's first
 * pass got wrong by burying categories behind a link inside the product
 * screen), and SISTEMA for the reporting/config tail. `CommandPalette` still
 * wants a flat list to search over — see `NAV_ITEMS_FLAT` below — so this
 * doesn't change what it searches, only how the sidebar groups it.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    title: "Operación",
    items: [
      {
        label: "Inicio",
        href: "/admin",
        icon: House,
        keywords: ["inicio", "resumen", "dashboard"],
      },
      {
        label: "Órdenes",
        href: "/admin/ordenes",
        icon: ClipboardText,
        keywords: ["ordenes", "pedidos", "ventas"],
      },
      {
        label: "Inventario",
        href: "/admin/inventario",
        icon: Package,
        keywords: ["inventario", "stock", "existencias"],
      },
      {
        label: "Solicitudes",
        href: "/admin/solicitudes",
        icon: Handshake,
        keywords: ["solicitudes", "embajadores", "patrocinios"],
      },
      {
        label: "Clientes",
        href: "/admin/clientes",
        icon: UsersThree,
        keywords: ["clientes", "compradores", "usuarios", "crm", "recurrentes"],
      },
      {
        label: "Cupones",
        href: "/admin/cupones",
        icon: Ticket,
        keywords: ["cupones", "descuentos", "promociones", "campanas", "codigos"],
      },
    ],
  },
  {
    // Transversal to both catalogs — a brand sells bikes and accessories
    // alike (`brand.model.ts`), so it can't live inside either catalog's own
    // section without implying it's scoped to just one of them.
    title: "Catálogo",
    items: [
      {
        label: "Marcas",
        href: "/admin/catalogo/marcas",
        icon: Storefront,
        keywords: ["marcas", "brands"],
      },
      {
        label: "Badges",
        href: "/admin/catalogo/badges",
        icon: Sparkle,
        keywords: ["badges", "etiquetas", "novedad", "bestseller"],
      },
      {
        label: "Colores",
        href: "/admin/catalogo/colores",
        icon: Swatches,
        keywords: ["colores", "colors", "plantillas", "variantes"],
      },
      {
        label: "Fichas técnicas",
        href: "/admin/catalogo/fichas-tecnicas",
        icon: ListChecks,
        keywords: ["fichas", "tecnicas", "plantillas", "especificaciones"],
      },
    ],
  },
  {
    // The storefront's editorial content — currently just the home hero,
    // which is why this is its own section rather than folded into
    // "Sistema": it isn't config, it's what a visitor sees.
    title: "Contenido",
    items: [
      {
        label: "Gestión de Home",
        href: "/admin/contenido/inicio",
        icon: Image,
        keywords: ["hero", "inicio", "carrusel", "home", "banner"],
      },
    ],
  },
  {
    title: "Bicicletas",
    items: [
      {
        label: "Categorías",
        href: "/admin/catalogo/categorias/bicicletas",
        icon: Tag,
        keywords: ["categorias", "bicicletas"],
      },
      {
        label: "Tallas",
        href: "/admin/catalogo/tallas/bicicletas",
        icon: Ruler,
        keywords: ["tallas", "sizes", "plantillas", "variantes", "bicicletas"],
      },
      {
        label: "Bicicletas",
        href: "/admin/catalogo/bicicletas",
        icon: Bicycle,
        keywords: ["catalogo", "bicicletas", "productos"],
      },
    ],
  },
  {
    title: "Accesorios",
    items: [
      {
        label: "Categorías",
        href: "/admin/catalogo/categorias/accesorios",
        icon: Tag,
        keywords: ["categorias", "accesorios"],
      },
      {
        label: "Tallas",
        href: "/admin/catalogo/tallas/accesorios",
        icon: Ruler,
        keywords: ["tallas", "sizes", "plantillas", "variantes", "accesorios"],
      },
      {
        label: "Accesorios",
        href: "/admin/catalogo/accesorios",
        icon: Package,
        keywords: ["catalogo", "accesorios", "productos"],
      },
    ],
  },

  {
    title: "Sistema",
    items: [
      {
        label: "Analítica",
        href: "/admin/analitica",
        icon: ChartBar,
        keywords: ["analitica", "estadisticas", "reportes", "preferencias"],
      },
      {
        label: "Configuración",
        href: "/admin/configuracion",
        icon: Gear,
        keywords: ["configuracion", "ajustes", "settings"],
      },
      {
        label: "Auditoría",
        href: "/admin/auditoria",
        icon: ClockCounterClockwise,
        keywords: ["auditoria", "bitacora", "log", "historial"],
        roles: ["superadmin"],
      },
    ],
  },
];

/** Flat view for consumers that don't care about grouping — `CommandPalette`'s search list. */
export const NAV_ITEMS_FLAT: readonly NavItem[] = NAV_SECTIONS.flatMap(
  (section) => section.items,
);

/**
 * Feeds `Breadcrumbs` — {slug: label} for every path segment under `/admin`.
 * Three routes now share the `bicicletas`/`accesorios` slug on purpose (the
 * product catalog, the category tree, and the size catalog all use it);
 * since all resolve to the same human label the collision is harmless.
 *
 * `categorias` and `tallas` need an explicit override here for the same
 * reason: since M10.1/this split, no nav item's href ends in the bare
 * segment anymore (every one goes one level deeper, to `.../bicicletas` or
 * `.../accesorios`), so `NAV_ITEMS_FLAT` alone can't derive a label for it —
 * without the override the breadcrumb would fall back to the raw, lowercase
 * slug instead of the intended section name.
 */
export const SEGMENT_LABELS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    NAV_ITEMS_FLAT.map((item) => [
      item.href.split("/").pop() ?? item.href,
      item.label,
    ]),
  ),
  catalogo: "Catálogo",
  categorias: "Categorías",
  tallas: "Tallas",
  nueva: "Nueva",
};
