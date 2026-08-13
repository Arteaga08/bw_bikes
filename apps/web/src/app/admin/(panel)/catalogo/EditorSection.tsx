import { Warning } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

export interface EditorSectionProps {
  /** Anchor id for the error summary to scroll/focus into — see `ErrorSummary`. */
  id: string;
  title: string;
  /** One line explaining what this section is for, capped near 65ch like any other body copy. */
  description?: string;
  /** The section's real limit, shown plainly instead of a control that just goes disabled. Turns amber once `current === max`. */
  count?: { current: number; max: number };
  children: ReactNode;
  className?: string;
}

/**
 * The editor's only surface primitive: one visual level up from the page's
 * `bg-base`, per DESIGN.md §4's flat-by-default rule — no shadow, just a
 * change of background and a border. Everything nested inside (spec groups,
 * variant rows) goes one level back *down* instead of stacking another card,
 * so nothing here is ever a card inside a card.
 */
export function EditorSection({ id, title, description, count, children, className }: EditorSectionProps) {
  const titleId = useId();
  const atLimit = count !== undefined && count.current >= count.max;

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={cn("rounded-card-lg border border-borde bg-surface", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-sm border-b border-borde px-lg py-md">
        <div className="flex flex-col gap-xs">
          <h2 id={titleId} className="font-display text-h3 text-negro">
            {title}
          </h2>
          {description ? <p className="max-w-[65ch] font-body text-caption text-grafito">{description}</p> : null}
        </div>
        {count ? (
          <span
            className={cn(
              "flex shrink-0 items-center gap-xs font-ui text-caption",
              atLimit ? "text-estado-advertencia" : "text-grafito",
            )}
            title={atLimit ? `Alcanzaste el máximo de ${count.max}.` : undefined}
          >
            {atLimit ? <Warning aria-hidden="true" size={14} weight="fill" /> : null}
            {count.current}/{count.max}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-md p-lg">{children}</div>
    </section>
  );
}
