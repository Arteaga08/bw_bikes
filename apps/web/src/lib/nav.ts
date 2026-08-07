import type { Icon } from "@phosphor-icons/react";
import { Bicycle, ChartBar, ClipboardText, Gear, Handshake, House, Package } from "@phosphor-icons/react";

export interface NavItem {
  label: string;
  href: string;
  icon: Icon;
  keywords: readonly string[];
}

/**
 * The seven real destinations of phase 2 (M8's plan §"Nav del shell").
 * M9–M11 replace each placeholder page's body; this list — and the shell
 * around it — doesn't change when they do.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Inicio", href: "/admin", icon: House, keywords: ["inicio", "resumen", "dashboard"] },
  { label: "Órdenes", href: "/admin/ordenes", icon: ClipboardText, keywords: ["ordenes", "pedidos", "ventas"] },
  {
    label: "Catálogo",
    href: "/admin/catalogo",
    icon: Bicycle,
    keywords: ["catalogo", "bicicletas", "accesorios", "productos"],
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
];

/** Feeds `Breadcrumbs` — {slug: label} for every path segment under `/admin`. */
export const SEGMENT_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.href.split("/").pop() ?? item.href, item.label]),
);
