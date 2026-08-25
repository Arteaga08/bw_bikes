import type { DisputeStatus } from "@bw-bikes/shared";
import { Badge } from "@/components/ui/Badge";
import { DISPUTE_STATUS_LABELS, disputeStatusBadgeVariant } from "@/lib/orders/status";

/** The one place a raw `DisputeStatus` becomes a `Badge` — mirrors `PaymentStateBadge`/`OrderStatusBadge`. */
export function DisputeStatusBadge({ status }: { status: DisputeStatus }) {
  return <Badge variant={disputeStatusBadgeVariant(status)}>{DISPUTE_STATUS_LABELS[status]}</Badge>;
}
