import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface DataTableColumn<TRow> {
  key: string;
  header: string;
  render: (row: TRow) => ReactNode;
  className?: string;
}

export interface DataTableProps<TRow> {
  columns: ReadonlyArray<DataTableColumn<TRow>>;
  rows: readonly TRow[];
  getRowKey: (row: TRow) => string;
}

/**
 * Deliberately dumb: renders exactly the rows it's given. Loading/empty/error
 * states are the page's responsibility (DASHBOARD_GUIDELINES.md §3's
 * loading → empty → data pattern) — a table that also decided when to show
 * `EmptyState` would force every caller through this component's opinion of
 * "empty", instead of the page's own fetch state machine.
 */
export function DataTable<TRow>({ columns, rows, getRowKey }: DataTableProps<TRow>) {
  return (
    <div className="overflow-x-auto rounded-card border border-borde bg-surface">
      <table className="w-full min-w-max border-collapse text-left">
        <thead>
          <tr className="border-b border-borde">
            {columns.map((column) => (
              <th key={column.key} className="px-md py-sm font-ui text-caption text-grafito uppercase">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)} className="border-b border-borde last:border-b-0">
              {columns.map((column) => (
                <td key={column.key} className={cn("px-md py-md font-body text-body text-negro", column.className)}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
