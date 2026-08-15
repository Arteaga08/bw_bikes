import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ButtonGroupProps {
  /** Names the set for assistive tech — "Reordenar grupo", "Cantidad". Rendered as `aria-label` on the group. */
  label: string;
  /** Two or more `Button`s, normally `variant="bare" size="icon"`. */
  children: ReactNode;
  className?: string;
}

/**
 * Marks the group as carrying its own white body, which `globals.css` keys the
 * children's hover off. Exported so the rare consumer that needs the class
 * (a static mockup, the CSS mirror in `handoff/tokens.css`) names it instead of
 * copying the string.
 */
export const BUTTON_GROUP_SOLID_CLASS = "btn-group-solid";

/**
 * Segmented container for adjacent controls that act on the same thing — the
 * subir/bajar arrows of a reorderable row, a −/+ quantity stepper.
 *
 * The point is grouping, not decoration: two loose glyphs read as two unrelated
 * actions, while one box with a hairline between them reads as one control with
 * two directions, which is what it is. The children stay borderless (`bare`),
 * so the group's own 1px border is the only edge drawn — no nested boxes, and
 * no shadow (DESIGN_SYSTEM.md §3.2).
 *
 * The group carries a permanent white body, not just an outline: the pair then
 * reads as one solid control sitting on the panel instead of an empty frame
 * drawn around two glyphs.
 *
 * Three details that look incidental and aren't:
 * - The divider is a right border on every child but the last, so it survives a
 *   child being conditionally rendered.
 * - No `overflow-hidden`. The focus ring is an `outline` with a 2px offset,
 *   drawn outside the child's box; clipping the group would swallow it and
 *   leave keyboard users with no visible focus (WCAG AA). The children keep
 *   their own 2px `rounded-control`, which at this radius is
 *   indistinguishable from the group's corner anyway.
 * - `btn-group-solid` is what `globals.css` keys the children's hover off.
 *   A `bare` button lifts to white on hover, which would be invisible against
 *   this white body, so inside a group it presses to `borde` instead. That
 *   lives in CSS rather than a utility class because two `hover:bg-*` classes
 *   on one element fight by generated-CSS order (see `lib/cn.ts`).
 */
export function ButtonGroup({ label, children, className }: ButtonGroupProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        BUTTON_GROUP_SOLID_CLASS,
        "inline-flex items-center rounded-control border border-borde bg-surface",
        "[&>*:not(:last-child)]:border-r [&>*:not(:last-child)]:border-r-borde",
        className,
      )}
    >
      {children}
    </div>
  );
}
