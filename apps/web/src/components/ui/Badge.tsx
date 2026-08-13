import type { BadgeVariant } from "@bw-bikes/shared";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type { BadgeVariant };

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
}

/**
 * `accent`/`unavailable` are the two variants DESIGN_SYSTEM.md §5 specs by
 * name ("Nuevo"/"E-Bike" and "Agotado"). `exito`/`advertencia`/`error`/
 * `neutral` are the semantic status set M9–M11's tables need (paid/pending/
 * cancelled, shipped/delivered) — built from the desaturated status tokens
 * added in globals.css so a row full of badges never competes with the
 * dashboard's one dorado accent. `BadgeVariant` itself lives in
 * `@bw-bikes/shared` (M10.3) so the backend's merchandising `Badge` model can
 * validate against this exact same closed set, instead of a hex the palette
 * never sanctioned.
 */
// Every variant declares its own border color, `neutral` included — a plain
// `border` base class plus `neutral`'s override would rely on the second
// `border-color` utility winning by source order, which `cn` (no
// tailwind-merge) doesn't guarantee. Declaring `border-transparent` on the
// other five keeps every badge the same box height regardless of variant,
// instead of `neutral` alone measuring 2px taller in a mixed status column.
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  accent: "border border-transparent bg-dorado text-negro",
  unavailable: "border border-transparent bg-grafito text-blanco",
  exito: "border border-transparent bg-estado-exito-soft text-estado-exito",
  advertencia: "border border-transparent bg-estado-advertencia-soft text-estado-advertencia",
  error: "border border-transparent bg-estado-error-soft text-estado-error",
  neutral: "border border-borde bg-base text-grafito",
};

export function Badge({ variant = "neutral", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-control px-sm py-1 font-ui text-badge uppercase",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
