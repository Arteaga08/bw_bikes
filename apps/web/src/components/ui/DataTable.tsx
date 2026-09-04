import type { ReactNode } from "react";
import { memo } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/cn";
import { MobileRowSkeleton, Skeleton } from "./Skeleton";

/** Tailwind's default `md` breakpoint — the same width `md:hidden`/`hidden md:block` switch on. */
const MD_BREAKPOINT_QUERY = "(min-width: 768px)";

/**
 * What a column actually holds — drives its default alignment so that
 * decision doesn't live in each view's head (`align` used to be free-choice,
 * and five tables picked five different answers for the same "a short
 * integer" shape: `CAMPOS` right-aligned in one, `ORDEN` centered in
 * another). `align` still exists as an escape hatch for the rare column that
 * genuinely isn't one of these.
 */
export type DataTableColumnKind = "text" | "number" | "status" | "actions";

const KIND_ALIGN: Record<DataTableColumnKind, "left" | "center" | "right"> = {
  text: "left",
  number: "right",
  // Categorical (a Badge), not numeric — aligning it like a number implies
  // an ordering it doesn't have.
  status: "left",
  actions: "right",
};

/** Narrower placeholder for a short kind so the loading row doesn't look wider than the data it's standing in for. */
const KIND_SKELETON_WIDTH: Record<DataTableColumnKind, string> = {
  text: "w-32",
  number: "w-12",
  status: "w-16",
  actions: "w-20",
};

export interface DataTableColumn<TRow> {
  key: string;
  header: ReactNode;
  render: (row: TRow) => ReactNode;
  className?: string;
  /** What this column holds — see `DataTableColumnKind`. Implies `align` and the skeleton's placeholder width; omit only for a column `align` alone can't describe. */
  kind?: DataTableColumnKind;
  /** Overrides the alignment `kind` would imply. Defaults to left when neither is set. */
  align?: "left" | "center" | "right";
}

export interface DataTableProps<TRow> {
  columns: ReadonlyArray<DataTableColumn<TRow>>;
  rows: readonly TRow[];
  getRowKey: (row: TRow) => string;
  /**
   * Renders each row as a single-surface list item below `md` instead of a
   * table cell (DASHBOARD_GUIDELINES.md §3's "[doble layout] Mobile: cards
   * con acciones inline · Desktop: tabla"). Optional and additive — a caller
   * that doesn't pass it keeps today's table-only behavior unchanged, at
   * every width.
   */
  mobileRow?: (row: TRow) => ReactNode;
  /**
   * Makes a desktop row clickable — the órdenes redesign's "row → detail" in
   * one click, instead of a dedicated "Ver detalle" button in every row.
   * Optional and additive: without it a row renders exactly as before,
   * including no `cursor-pointer`.
   *
   * The keyboard-accessible route to the same action is a focusable element
   * inside one of the row's own columns (a button-styled folio cell, for
   * instance) — the `<tr>` itself never becomes a tab stop, so this doesn't
   * duplicate or fight with that column's own click handler.
   */
  onRowClick?: (row: TRow) => void;
  /**
   * Floor for the `<table>`'s width, so columns get a real share of the
   * surface instead of shrinking to their content (which left visible blank
   * space on wide screens once `table-auto` alone was in charge). The
   * wrapper already scrolls horizontally, so a table with more columns than
   * this floor allows for still degrades to a scrollbar, never to squashed
   * text. Defaults to a five-to-six-column list like the catalog tables.
   */
  minWidthClassName?: string;
}

const ALIGN_CLASSES: Record<NonNullable<DataTableColumn<unknown>["align"]>, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

function resolveAlign<TRow>(column: DataTableColumn<TRow>): "left" | "center" | "right" {
  return column.align ?? (column.kind ? KIND_ALIGN[column.kind] : "left");
}

/**
 * Deliberately dumb: renders exactly the rows it's given. Loading/empty/error
 * states are the page's responsibility (DASHBOARD_GUIDELINES.md §3's
 * loading → empty → data pattern) — a table that also decided when to show
 * `EmptyState` would force every caller through this component's opinion of
 * "empty", instead of the page's own fetch state machine.
 */
/**
 * Elements a row click must not hijack — the selection checkbox, per-row
 * action buttons (Confirmar/Rechazar), and anything else genuinely
 * interactive inside a cell. Without this guard, `onRowClick` fires *in
 * addition to* whatever the user actually clicked.
 */
const ROW_CLICK_EXCLUDE_SELECTOR = "button, input, a, select, label, textarea";

function DataTableInner<TRow>({
  columns,
  rows,
  getRowKey,
  mobileRow,
  onRowClick,
  minWidthClassName = "min-w-[46rem]",
}: DataTableProps<TRow>) {
  // Only one layout actually renders now, not both hidden behind `md:` —
  // with `mobileRow` set, every row used to mount twice (a card + a `<tr>`),
  // so a 20-row table paid for 40 row subtrees and `column.render(row)` ran
  // twice per row even though one copy was always `display: none`.
  // `useMediaQuery`'s server snapshot is `false` (mobile), matching the
  // server-rendered HTML, so hydration never mismatches; a real desktop
  // client corrects to the table layout in the render right after.
  const isDesktop = useMediaQuery(MD_BREAKPOINT_QUERY);

  if (mobileRow && !isDesktop) {
    return (
      <div className="rounded-card border border-borde bg-surface">
        {rows.map((row) => (
          <div key={getRowKey(row)} className="border-b border-borde last:border-b-0">
            {mobileRow(row)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-borde bg-surface">
      <table className={cn("w-full table-auto border-collapse text-left", minWidthClassName)}>
        <TableHead columns={columns} />
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              className={cn("border-b border-borde last:border-b-0 hover:bg-base", onRowClick && "cursor-pointer")}
              onClick={
                onRowClick
                  ? (event) => {
                      if ((event.target as HTMLElement).closest(ROW_CLICK_EXCLUDE_SELECTOR)) return;
                      onRowClick(row);
                    }
                  : undefined
              }
            >
              {columns.map((column, index) => (
                <td
                  key={column.key}
                  className={cn(
                    "px-md py-sm font-body text-body text-negro",
                    ALIGN_CLASSES[resolveAlign(column)],
                    index < columns.length - 1 && "border-r border-borde/50",
                    column.className,
                  )}
                >
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

/**
 * `React.memo`-wrapped: the single table primitive every heavy admin list
 * (órdenes, catálogo, inventario, ...) renders through, so a shallow-equal
 * skip here pays off everywhere at once. It only helps as much as its
 * callers keep `columns`/`rows`/`getRowKey`/`mobileRow` referentially
 * stable across renders that don't actually change what a row shows — see
 * `OrdersView.tsx` for the pattern (`useMemo` columns, `useCallback` row
 * renderers, a module-level `getRowKey`). `as typeof DataTableInner`
 * preserves the generic signature `memo()` would otherwise erase.
 */
export const DataTable = memo(DataTableInner) as typeof DataTableInner;

/**
 * Exported so a loading skeleton can render the exact same header the real
 * table will — otherwise the header pops into existence only once data
 * lands, which reads as "the header was missing" rather than "was loading".
 * Columns get a `border-r` between them at full `borde` strength here; the
 * body (`DataTable`'s own `<td>`s) continues the same rule at half opacity —
 * present as a column guide, but never as loud as a spreadsheet grid.
 */
export function TableHead<TRow>({ columns }: { columns: ReadonlyArray<DataTableColumn<TRow>> }) {
  return (
    <thead>
      {/* `bg-inset`, not `bg-base`: the table sits on a `bg-surface` card, and
          `base` is also the row hover color — a hovered row and the header
          used to land on the exact same fill. */}
      <tr className="border-b border-borde bg-inset">
        {columns.map((column, index) => (
          <th
            key={column.key}
            scope="col"
            className={cn(
              "px-md py-sm font-ui text-caption tracking-[1px] text-grafito uppercase",
              ALIGN_CLASSES[resolveAlign(column)],
              index < columns.length - 1 && "border-r border-borde",
            )}
          >
            {column.header}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/**
 * Loading counterpart to `DataTable` — same shell, same real `TableHead`
 * (so the header doesn't pop in once data lands), and skeleton cells that
 * honor each column's `align`/`kind`/`className` so the placeholder rows are
 * the same shape as the real ones instead of jumping when data arrives.
 */
export function DataTableSkeleton<TRow>({
  columns,
  rows = 5,
  minWidthClassName = "min-w-[46rem]",
  mobile = false,
}: {
  columns: ReadonlyArray<DataTableColumn<TRow>>;
  rows?: number;
  minWidthClassName?: string;
  /** Mirrors `DataTable`'s `mobileRow` — pass when the real table will render one, so the loading state doesn't briefly show the wide table on a phone before flipping to cards. */
  mobile?: boolean;
}) {
  return (
    <>
      {mobile ? (
        <div className="rounded-card border border-borde bg-surface md:hidden">
          {Array.from({ length: rows }, (_, rowIndex) => (
            <div key={rowIndex} className="border-b border-borde last:border-b-0">
              <MobileRowSkeleton />
            </div>
          ))}
        </div>
      ) : null}
      <div className={cn("overflow-x-auto rounded-card border border-borde bg-surface", mobile && "hidden md:block")}>
        <table className={cn("w-full table-auto border-collapse text-left", minWidthClassName)}>
          <TableHead columns={columns} />
          <tbody>
            {Array.from({ length: rows }, (_, rowIndex) => (
              <tr key={rowIndex} className="border-b border-borde last:border-b-0">
                {columns.map((column, index) => {
                  const align = resolveAlign(column);
                  return (
                    <td
                      key={column.key}
                      className={cn(
                        "px-md py-sm",
                        ALIGN_CLASSES[align],
                        index < columns.length - 1 && "border-r border-borde/50",
                        column.className,
                      )}
                    >
                      <Skeleton
                        className={cn(
                          "h-4",
                          align === "right" ? "ml-auto" : align === "center" ? "mx-auto" : "",
                          column.kind ? KIND_SKELETON_WIDTH[column.kind] : "w-24",
                        )}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * Single container for a row's action buttons — no `flex-wrap`, so three
 * `sm` buttons stay on one line instead of splitting across two the way
 * `md`-sized, wrapping buttons used to.
 */
export function TableRowActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-xs">{children}</div>;
}
