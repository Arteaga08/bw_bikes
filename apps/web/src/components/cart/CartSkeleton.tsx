import { Skeleton } from "@/components/ui/Skeleton";

/** 3 líneas + resumen, mismo alto aproximado que el estado cargado para no saltar el layout. */
export function CartSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-lg lg:grid-cols-[1fr_320px]">
      <ul className="flex flex-col gap-lg">
        {[0, 1, 2].map((index) => (
          <li key={index} className="flex gap-md">
            <Skeleton className="h-24 w-24 shrink-0 rounded-control" />
            <div className="flex flex-1 flex-col gap-xs">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-24" />
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-sm rounded-card-lg border border-borde bg-surface p-lg">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}
