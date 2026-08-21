import { Circle } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /**
   * `neutral` (default) for a plain count. `exito`/`advertencia`/`error` mark
   * the tile as itself good news or itself the alert (e.g. "Pendientes" with
   * an overdue count) via a small filled dot beside the label, plus tinting
   * the `hint` line the same way `Badge` tints its text. The big number
   * itself always stays `text-negro`: DESIGN_SYSTEM.md rules out
   * `box-shadow`/gradients for signaling state, so weight there would read
   * as a typo, not a status.
   *
   * Replaces a `border-l-4` side-stripe this component carried through M9
   * (2026-08): `impeccable`'s shared design laws call a colored side border
   * on a card the single most recognizable AI-generated-UI tell, and
   * DESIGN.md §2's "Text-Only Direction Rule" (written for the Inicio
   * redesign) settles it in this system's own terms — direction lives in
   * text and glyphs, never in a bar, stripe, or fill. Fixed once the M11
   * inventory milestone that depended on this shell's exact geometry closed,
   * clearing the way to touch every screen that renders one.
   */
  tone?: "neutral" | "exito" | "advertencia" | "error";
  /** Renders as a button and jumps the admin to the filtered view the tile summarizes. */
  onClick?: () => void;
  /** Marks this tile as the currently-applied filter (Inventario's cards toggle a filter in place rather than navigating away) — same `bg-inset` a hover already uses, just persistent. */
  active?: boolean;
  /** A `DeltaIndicator` (or equivalent) — the reference number that makes `value` mean something. Renders below `value`, above `hint`. */
  delta?: ReactNode;
  /**
   * A `Sparkline` (or equivalent) trend line. Renders last, in its own
   * full-width row below `label`/`value`/`delta`/`hint` — not beside them.
   * At `xl:grid-cols-4` a card's content box is ~222px; `value` alone (e.g.
   * `"$872,000.00"` at `text-h2`) already spends most of that, so a
   * sparkline with min/max/period context (needed after the 2026-08 fix —
   * see `Sparkline.tsx`) has nowhere to sit beside it without wrapping or
   * truncating the very context it exists to add.
   */
  spark?: ReactNode;
}

const TONE_DOT_CLASSES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  neutral: "",
  exito: "text-estado-exito",
  advertencia: "text-estado-advertencia",
  error: "text-estado-error",
};

const TONE_HINT_CLASSES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  neutral: "text-grafito",
  exito: "text-estado-exito",
  advertencia: "text-estado-advertencia",
  error: "text-estado-error",
};

const CARD_SHELL = "flex flex-col gap-sm rounded-card border border-borde bg-surface p-lg";

/**
 * The KPI tile `StatCardSkeleton` (Skeleton.tsx) has reserved a slot for
 * since M9 without a real component behind it — same shell so loading →
 * loaded never shifts layout.
 */
export function StatCard({ label, value, hint, tone = "neutral", onClick, active = false, delta, spark }: StatCardProps) {
  const content = (
    <div className="flex flex-col gap-sm">
      <span className="flex items-center gap-xs font-ui text-eyebrow text-grafito uppercase">
        {tone !== "neutral" ? (
          <Circle weight="fill" size={8} aria-hidden="true" className={cn("shrink-0", TONE_DOT_CLASSES[tone])} />
        ) : null}
        {label}
      </span>
      <span className="font-display text-h2 text-negro">{value}</span>
      {delta}
      {hint ? <span className={cn("font-body text-caption", TONE_HINT_CLASSES[tone])}>{hint}</span> : null}
      {spark ? <div className="pt-xs">{spark}</div> : null}
    </div>
  );

  if (!onClick) {
    return <div className={CARD_SHELL}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        CARD_SHELL,
        "text-left transition-colors duration-150 hover:bg-inset focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro",
        active && "bg-inset",
      )}
    >
      {content}
    </button>
  );
}
