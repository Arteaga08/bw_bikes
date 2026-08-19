import { ArrowDown, ArrowUp, Minus } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export interface DeltaIndicatorProps {
  current: number;
  /** `null` when the previous window has no orders at all — a different fact from "zero", see `OrdersStatsPrevious`. */
  previous: number | null;
  /** Which direction of change reads as good news for this metric. Default `"up"` (revenue, order count); pass `"down"` for a metric where less is better. */
  goodDirection?: "up" | "down";
  /** What `previous` is measured against, e.g. "vs. periodo anterior". */
  periodLabel: string;
}

const PERCENT_FORMATTER = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });

/**
 * A number alone is not a statistic — this is the reference every KPI in
 * `HomeStats` needs to mean anything (see the Inicio redesign plan). Color
 * never carries the message alone: the sign is in the text itself
 * ("+12%"/"-8%") and every state also gets a distinct icon, satisfying the
 * "never color-only" a11y rule `handoff/tokens.css` already states for
 * estado-* tokens elsewhere in this system.
 *
 * Direction is measured on `estado-*` as **text color only**, never as a
 * fill — the only use the contrast validator clears (`estado-exito` on
 * `surface` is 4.48:1; the same token as an adjacent fill drops to ~1.8:1,
 * below the 3:1 floor). See DESIGN.md §2, "Codificación de datos".
 */
export function DeltaIndicator({ current, previous, goodDirection = "up", periodLabel }: DeltaIndicatorProps) {
  // No baseline at all — a percentage against zero orders is undefined, not
  // "+100%". Say so plainly instead of rendering a number that lies.
  if (previous === null || previous === 0) {
    return (
      <span className="flex items-center gap-xs font-body text-caption text-grafito">
        <Minus size={12} weight="bold" aria-hidden="true" />
        Sin base de comparación
      </span>
    );
  }

  if (current === previous) {
    return (
      <span className="flex items-center gap-xs font-body text-caption text-grafito">
        <Minus size={12} weight="bold" aria-hidden="true" />
        Sin cambio {periodLabel}
      </span>
    );
  }

  const direction: "up" | "down" = current > previous ? "up" : "down";
  const isGood = direction === goodDirection;
  const percent = Math.round(Math.abs((current - previous) / previous) * 100);
  const sign = direction === "up" ? "+" : "-";
  const Icon = direction === "up" ? ArrowUp : ArrowDown;
  const toneClass = isGood ? "text-estado-exito" : "text-estado-error";

  return (
    <span className={cn("flex items-center gap-xs font-body text-caption", toneClass)}>
      <Icon size={12} weight="bold" aria-hidden="true" />
      {sign}
      {PERCENT_FORMATTER.format(percent)}% {periodLabel}
    </span>
  );
}
