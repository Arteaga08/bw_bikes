"use client";

import { CaretRight } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { SEGMENT_LABELS } from "@/lib/nav";

interface Crumb {
  label: string;
  href: string;
}

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  let href = "";
  return segments.map((segment) => {
    href += `/${segment}`;
    return { label: SEGMENT_LABELS[segment] ?? segment, href };
  });
}

/** Derived from `usePathname` against the {slug: label} map in `lib/nav.ts` — last item is text, the rest are links. */
export function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Migas de pan" className="flex items-center gap-xs border-b border-borde px-lg py-sm">
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
