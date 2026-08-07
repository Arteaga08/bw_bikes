import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-md border-b border-borde px-lg py-lg">
      <div>
        <h1 className="font-display text-h2 text-negro">{title}</h1>
        {subtitle ? <p className="mt-xs font-body text-body text-grafito">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-sm">{actions}</div> : null}
    </div>
  );
}
