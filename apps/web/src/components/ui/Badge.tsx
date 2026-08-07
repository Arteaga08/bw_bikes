import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * `accent`/`unavailable` are the two variants DESIGN_SYSTEM.md §5 specs by
 * name ("Nuevo"/"E-Bike" and "Agotado"). `exito`/`advertencia`/`error`/
 * `neutral` are the semantic status set M9–M11's tables need (paid/pending/
 * cancelled, shipped/delivered) — built from the desaturated status tokens
 * added in globals.css so a row full of badges never competes with the
 * dashboard's one dorado accent.
 */
export type BadgeVariant = "accent" | "unavailable" | "exito" | "advertencia" | "error" | "neutral";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  accent: "bg-dorado text-negro",
  unavailable: "bg-grafito text-blanco",
  exito: "bg-estado-exito-soft text-estado-exito",
  advertencia: "bg-estado-advertencia-soft text-estado-advertencia",
  error: "bg-estado-error-soft text-estado-error",
  neutral: "bg-base text-grafito border border-borde",
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
