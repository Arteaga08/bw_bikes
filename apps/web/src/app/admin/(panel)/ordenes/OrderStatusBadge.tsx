import type { OrderStatus } from "@bw-bikes/shared";
import { Badge } from "@/components/ui/Badge";
import { ORDER_STATUS_LABELS, orderStatusBadgeVariant } from "@/lib/orders/status";

/** The one place a raw `OrderStatus` becomes a `Badge` — every table row and the detail header use this. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={orderStatusBadgeVariant(status)}>{ORDER_STATUS_LABELS[status]}</Badge>;
}
