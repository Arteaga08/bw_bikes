import { cn } from "@/lib/cn";

/** Base shimmer block — `.skeleton` (globals.css) reserves its slot; sizing comes from `className`. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton", className)} />;
}

export function StatCardSkeleton() {
  return (
    <div className="flex flex-col gap-sm rounded-card border border-borde bg-surface p-lg">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-32" />
    </div>
  );
}

export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }, (_, index) => (
        <td key={index} className="px-md py-md">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

/**
 * The `mobileRow` counterpart to `TableRowSkeleton` — same list-item shell a
 * real `DataTable` mobile row renders into, so the loading state doesn't
 * shift layout once data lands (`DASHBOARD_GUIDELINES.md` §7's "skeletons
 * que reservan el slot").
 */
export function MobileRowSkeleton() {
  return (
    <div className="flex flex-col gap-sm p-md">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-1/3" />
      <div className="flex items-center justify-between gap-sm">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

/** Loading counterpart to a product card (`CatalogView`'s grid) — same photo-then-body-then-footer shape so the grid doesn't reflow once data lands. */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-card-lg border border-borde bg-surface">
      <Skeleton className="aspect-4/3 w-full rounded-none" />
      <div className="flex flex-col gap-sm p-md">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="flex items-center gap-sm border-t border-borde p-md">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-20" />
      </div>
    </div>
  );
}

export function FormSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <div className="flex flex-col gap-md">
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="flex flex-col gap-xs">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
    </div>
  );
}
