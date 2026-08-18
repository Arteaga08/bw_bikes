import type { OrderPriority } from "@bw-bikes/shared";
import { Badge } from "@/components/ui/Badge";
import { ORDER_PRIORITY_LABELS, orderPriorityBadgeVariant } from "@/lib/orders/status";

/** The one place a raw `OrderPriority` becomes a `Badge` — mirrors `OrderStatusBadge`. */
export function OrderPriorityBadge({ priority }: { priority: OrderPriority }) {
  return <Badge variant={orderPriorityBadgeVariant(priority)}>{ORDER_PRIORITY_LABELS[priority]}</Badge>;
}
