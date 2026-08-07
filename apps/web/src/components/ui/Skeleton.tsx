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
