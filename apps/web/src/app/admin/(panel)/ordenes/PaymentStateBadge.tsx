import type { PaymentState } from "@bw-bikes/shared";
import { Badge } from "@/components/ui/Badge";
import { PAYMENT_STATE_LABELS, paymentStateBadgeVariant } from "@/lib/orders/status";

/** The one place a raw `PaymentState` becomes a `Badge` — mirrors `OrderStatusBadge`. */
export function PaymentStateBadge({ state }: { state: PaymentState }) {
  return <Badge variant={paymentStateBadgeVariant(state)}>{PAYMENT_STATE_LABELS[state]}</Badge>;
}
