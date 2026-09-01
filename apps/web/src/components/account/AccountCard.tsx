import type { ReactNode } from "react";

export interface AccountCardProps {
  title: string;
  /** Rendered top-right of the title — usually a "Editar" button/link. */
  action?: ReactNode;
  children: ReactNode;
}

/** Generic card shell reused by every `/mi-cuenta` section: title + content + an optional action next to the title. */
export function AccountCard({ title, action, children }: AccountCardProps) {
  return (
    <section className="rounded-card-lg border border-borde bg-surface p-lg">
      <div className="flex items-start justify-between gap-sm">
        <h2 className="font-display text-h4 text-negro">{title}</h2>
        {action}
      </div>
      <div className="mt-md">{children}</div>
    </section>
  );
}
