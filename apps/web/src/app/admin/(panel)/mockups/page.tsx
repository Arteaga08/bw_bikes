import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

/**
 * Scaffolding for M10.5 — not a product screen. Lives here (instead of a
 * static image or a separate tool) so every variant is judged inside the
 * real shell: same Sidebar, same TopBar, same tokens, same `<main>` scroll
 * container. Nothing here is imported by production code and nothing here
 * is wired into `lib/nav.ts` — it's deleted whole once M10.5 closes.
 */
const PAGES = [
  {
    href: "/admin/mockups/tarjetas",
    title: "Tarjeta de producto",
    description: "3 variantes para la lista de bicicletas/accesorios en rejilla (punto 8a).",
  },
  {
    href: "/admin/mockups/botones",
    title: "Estados de botón",
    description: "El caso del ghost sin contraste dentro de una fila, más el destructivo en rojo (puntos 6 y 7).",
  },
  {
    href: "/admin/mockups/tablas",
    title: "Encabezados de tabla",
    description: "Regla de alineación por tipo de columna y tres tratamientos de separación (punto 8b).",
  },
  {
    href: "/admin/mockups/categoria",
    title: "Selector de categoría",
    description: "3 variantes para reemplazar el <select> con optgroup duplicado (punto 1).",
  },
] as const;

export default function MockupsIndexPage() {
  return (
    <>
      <PageHeader
        title="Mockups — M10.5"
        subtitle="Andamio temporal para decidir mirando, no leyendo código. Se borra al cerrar M10.5."
      />
      <div className="flex flex-col gap-md p-md sm:p-lg">
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          {PAGES.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="flex flex-col gap-xs rounded-card-lg border border-borde bg-surface p-lg transition-colors duration-150 hover:border-negro focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro"
            >
              <span className="font-display text-h3 text-negro">{page.title}</span>
              <span className="max-w-[65ch] font-body text-caption text-grafito">{page.description}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
