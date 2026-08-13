import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Never a blank screen (FRONTEND_GUIDELINES.md §6) — icon + message + optional action. */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-sm rounded-card border border-borde bg-surface p-xl text-center sm:p-3xl">
      {icon ? (
        <div aria-hidden="true" className="text-grafito">
          {icon}
        </div>
      ) : null}
      <p className="font-ui text-ui text-negro">{title}</p>
      {description ? <p className="max-w-card font-body text-body text-grafito">{description}</p> : null}
      {action ? <div className="mt-sm">{action}</div> : null}
    </div>
  );
}
