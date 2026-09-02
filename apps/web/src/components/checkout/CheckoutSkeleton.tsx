import { Skeleton } from "@/components/ui/Skeleton";

/** Loading state for the whole `/checkout/envio` grid — same two-column shape as the loaded page, so nothing shifts once data lands. */
export function CheckoutSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-xl lg:grid-cols-[1fr_21rem]">
      <div className="flex flex-col gap-md">
        {[0, 1].map((index) => (
          <div key={index} className="flex flex-col gap-md rounded-card-lg border border-borde bg-surface p-xl">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-sm rounded-card-lg border border-borde bg-surface p-lg">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}
