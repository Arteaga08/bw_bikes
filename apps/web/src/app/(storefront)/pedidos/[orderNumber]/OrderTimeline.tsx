import type { OrderStatusHistoryEntry } from "@bw-bikes/shared";
import { formatDateTime } from "@/lib/orders/format";
import { ORDER_STATUS_LABELS } from "@/lib/orders/status";

export interface OrderTimelineProps {
  entries: OrderStatusHistoryEntry[];
}

/** Same left-border rail as the admin panel's `OrderStatusHistoryList`, without the actor id — that's staff-only context, not something a customer needs. */
export function OrderTimeline({ entries }: OrderTimelineProps) {
  return (
    <ol className="flex flex-col gap-sm">
      {entries.map((entry, index) => (
        <li key={`${entry.status}-${entry.at}-${index}`} className="border-l-2 border-borde pl-md">
          <p className="font-ui text-ui text-negro">{ORDER_STATUS_LABELS[entry.status]}</p>
          <p className="font-body text-caption text-grafito">{formatDateTime(entry.at)}</p>
        </li>
      ))}
    </ol>
  );
}
