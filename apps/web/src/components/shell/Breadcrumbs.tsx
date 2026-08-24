"use client";

import { CaretRight } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { SEGMENT_LABELS } from "@/lib/nav";

export interface Crumb {
  label: string;
  href: string;
}

/** A Mongo `ObjectId`: 24 hex chars — an editor route's `[id]` segment, never a label worth showing raw. */
const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

/** Exported so `TopBar` can derive its mobile "back to parent" link from the same source of truth. */
export function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  let href = "";
  return segments.map((segment) => {
    href += `/${segment}`;
    const label = SEGMENT_LABELS[segment] ?? (OBJECT_ID_PATTERN.test(segment) ? "Editar" : segment);
    return { label, href };
  });
}

/**
 * Derived from `usePathname` against the {slug: label} map in `lib/nav.ts` —
 * last item is text, the rest are links. A single crumb (a top-level page
 * like Inicio) says nothing the page's own `PageHeader` title doesn't already
 * say right below it, so it renders nothing rather than a redundant one-word
 * line — real hierarchy (Catálogo › Colores) still needs at least two.
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  if (crumbs.length <= 1) return null;

  return (
    <nav
      aria-label="Migas de pan"
      className="hidden items-center gap-xs overflow-x-auto border-b border-borde px-lg py-sm whitespace-nowrap md:flex"
    >
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <Fragment key={crumb.href}>
            {index > 0 ? <CaretRight aria-hidden="true" size={12} className="text-grafito" /> : null}
            {isLast ? (
              <span className="font-ui text-caption text-negro">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="font-ui text-caption text-grafito hover:text-negro">
                {crumb.label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
