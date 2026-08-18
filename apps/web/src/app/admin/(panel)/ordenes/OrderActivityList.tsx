import type { OrderTimelineEntry } from "@/lib/orders/activity";
import { formatDateTime } from "@/lib/orders/format";

/**
 * The detail's "Bitácora" — renders `buildOrderTimeline`'s fused, pre-labeled
 * result (status moves + the audit trail, newest first). Purely a renderer:
 * the merge/sort/label logic lives in `lib/orders/activity.ts` so it stays
 * unit-testable without mounting a component.
 */
export function OrderActivityList({ entries }: { entries: OrderTimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="font-body text-caption text-grafito">Sin actividad registrada.</p>;
  }

  return (
    <ol className="flex flex-col gap-sm">
      {entries.map((entry) => (
        <li key={entry.key} className="border-l-2 border-borde pl-md">
          <p className="font-ui text-ui text-negro">{entry.label}</p>
          <p className="font-body text-caption text-grafito">
            {formatDateTime(entry.at)} · {entry.actorType === "system" ? "sistema" : `admin ${entry.actorId ?? ""}`}
          </p>
        </li>
      ))}
    </ol>
  );
}
