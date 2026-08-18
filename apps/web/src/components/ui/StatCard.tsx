import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /**
   * `neutral` (default) for a plain count. `exito`/`advertencia`/`error` mark
   * the tile with a colored left accent stripe (and tint the `hint` line the
   * same way `Badge` tints its text) — `exito` for a tile that's itself good
   * news (e.g. "Pagos" with something captured), the other two for a tile
   * that's itself the alert (e.g. "Pendientes" with an overdue count). The
   * big number itself always stays `text-negro`: DESIGN_SYSTEM.md §3.2 rules
   * out `box-shadow`/gradients for signaling state, and a stripe reads as
   * "this tile has a status" at a glance in a way a merely-dark-green number
   * next to a merely-black one doesn't.
   */
  tone?: "neutral" | "exito" | "advertencia" | "error";
  /** Renders as a button and jumps the admin to the filtered view the tile summarizes. */
  onClick?: () => void;
}

/**
 * Left border only — width and color, so it composes with the plain 1px
 * `borde` on the other three sides without two utilities fighting over the
 * same `border-color` shorthand (the exact trap `Badge.tsx` calls out with
 * `cn`'s lack of tailwind-merge: `border-{color}` and `border-l-{color}`
 * would both resolve `border-left-color`, and which one wins would depend on
 * Tailwind's generated CSS order, not the string order here). `border-l-4`
 * lives on every tone, `neutral` included, so a plain tile still reads as
 * "this card family always has a stripe" rather than only the alerted ones
 * growing an edge no other tile has.
 */
const TONE_ACCENT_CLASSES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  neutral: "border-l-borde",
  exito: "border-l-estado-exito",
  advertencia: "border-l-estado-advertencia",
  error: "border-l-estado-error",
};

const TONE_HINT_CLASSES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  neutral: "text-grafito",
  exito: "text-estado-exito",
  advertencia: "text-estado-advertencia",
  error: "text-estado-error",
};

const CARD_SHELL =
  "flex flex-col gap-sm rounded-card bg-surface p-lg border-t border-r border-b border-t-borde border-r-borde border-b-borde border-l-4";

/**
 * The KPI tile `StatCardSkeleton` (Skeleton.tsx) has reserved a slot for
 * since M9 without a real component behind it — same shell so loading →
 * loaded never shifts layout.
 */
export function StatCard({ label, value, hint, tone = "neutral", onClick }: StatCardProps) {
  const content = (
    <>
      <span className="font-ui text-eyebrow text-grafito uppercase">{label}</span>
      <span className="font-display text-h2 text-negro">{value}</span>
      {hint ? <span className={cn("font-body text-caption", TONE_HINT_CLASSES[tone])}>{hint}</span> : null}
    </>
  );

  if (!onClick) {
    return <div className={cn(CARD_SHELL, TONE_ACCENT_CLASSES[tone])}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        CARD_SHELL,
        TONE_ACCENT_CLASSES[tone],
        "text-left transition-colors duration-150 hover:bg-inset focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro",
      )}
    >
      {content}
    </button>
  );
}
