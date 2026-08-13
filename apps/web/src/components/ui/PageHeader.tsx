import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-md border-b border-borde px-md py-lg sm:flex-row sm:items-start sm:justify-between sm:px-lg">
      <div className="min-w-0">
        <h1 className="font-display text-h3 text-negro sm:text-h2">{title}</h1>
        {subtitle ? <p className="mt-xs font-body text-body text-grafito">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex w-full flex-col gap-sm sm:w-auto sm:flex-row sm:items-center">{actions}</div> : null}
    </div>
  );
}
