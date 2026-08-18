import type { Icon } from "@phosphor-icons/react";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { cn } from "@/lib/cn";

export interface AlertCardProps {
  icon: Icon;
  label: string;
  count: number;
  href: string;
  /**
   * `neutral` for "nothing to act on" (the count is 0) — plain surface, no
   * tint. `advertencia`/`error` mark something that needs attention, with a
   * full soft-tint fill (same `bg-estado-*-soft text-estado-*` pairing
   * `Badge` already uses) — never a side stripe: a colored border-left/right
   * as the only accent reads as decoration, not state, and this system's
   * tables already carry that meaning through icon + fill instead.
   */
  tone: "neutral" | "advertencia" | "error";
}

const TONE_CLASSES: Record<AlertCardProps["tone"], string> = {
  neutral: "bg-surface border border-borde text-negro",
  advertencia: "bg-estado-advertencia-soft border border-transparent text-estado-advertencia",
  error: "bg-estado-error-soft border border-transparent text-estado-error",
};

/**
 * One alert type per tile on `/admin` Inicio — pedidos entrantes, stock bajo,
 * problemas con órdenes, solicitudes pendientes. Deliberately not a bell/menu
 * (see `MILESTONES.md`'s M11 notes): four alerts sharing one dropdown hides
 * which is which behind an extra click; a row of named tiles answers "qué
 * necesita mi atención" without opening anything.
 */
export function AlertCard({ icon: IconComponent, label, count, href, tone }: AlertCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-md rounded-card p-lg transition-colors duration-150",
        "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro",
        TONE_CLASSES[tone],
        tone === "neutral" ? "hover:bg-inset" : "hover:brightness-95",
      )}
    >
      <IconComponent size={24} weight="regular" aria-hidden="true" className="shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-display text-h3">{count}</span>
        <span className="truncate font-ui text-ui">{label}</span>
      </span>
      <ArrowRight size={16} weight="regular" aria-hidden="true" className="shrink-0 opacity-60" />
    </Link>
  );
}
