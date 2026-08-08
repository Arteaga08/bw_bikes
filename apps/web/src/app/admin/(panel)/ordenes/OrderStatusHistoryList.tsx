import type { AdminOrderStatusHistoryEntry } from "@bw-bikes/shared";
import { ORDER_STATUS_LABELS } from "@/lib/orders/status";
import { formatDateTime } from "@/lib/orders/format";

/**
 * `confirmSupplierStock`/`rejectSupplierStock` write their history entries
 * with `actorType: "system"` and no `actorId` even though a human triggered
 * them (`markPaid`/`markCanceled` in `order.service.ts`) — only
 * `recordShipment` and the bulk endpoint attribute a real admin. There's no
 * endpoint to resolve an admin id to a name, so a human-triggered entry
 * shows the raw id, not a name.
 */
export function OrderStatusHistoryList({ entries }: { entries: AdminOrderStatusHistoryEntry[] }) {
  return (
    <ol className="flex flex-col gap-sm">
      {entries.map((entry, index) => (
        <li key={`${entry.status}-${entry.at}-${index}`} className="border-l-2 border-borde pl-md">
          <p className="font-ui text-ui text-negro">{ORDER_STATUS_LABELS[entry.status]}</p>
          <p className="font-body text-caption text-grafito">
            {formatDateTime(entry.at)} · {entry.actorType === "system" ? "sistema" : `admin ${entry.actorId ?? ""}`}
          </p>
          {entry.reason ? <p className="mt-xs font-body text-caption text-grafito">{entry.reason}</p> : null}
        </li>
      ))}
    </ol>
  );
}
