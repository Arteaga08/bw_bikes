import type { Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

export interface OrderDetailCardProps {
  icon: Icon;
  title: string;
  /** e.g. the "Editar" / "Capturar guía" text button a few sections need next to their own title. */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * The section wrapper the flat modal was missing: `bg-inset` (the design
 * system's token for "a panel nested inside a card", DESIGN_SYSTEM.md — the
 * modal body itself is already `bg-surface`) gives every section a real
 * boundary instead of a bare `<h3>` floating on the same white as everything
 * else. Every `Input`/`Select`/native `<select>` inside is `bg-surface`, so
 * it gains a body against the inset background instead of blending into it.
 */
export function OrderDetailCard({ icon: IconComponent, title, action, children }: OrderDetailCardProps) {
  return (
    <section className="rounded-card border border-borde bg-inset p-md">
      <div className="flex items-center justify-between gap-sm">
        <h3 className="flex items-center gap-xs font-ui text-eyebrow uppercase tracking-[3px] text-grafito">
          <IconComponent size={16} aria-hidden="true" />
          {title}
        </h3>
        {action}
      </div>
      <div className="mt-sm">{children}</div>
    </section>
  );
}
