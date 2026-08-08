"use client";

import { Badge } from "@/components/ui/Badge";
import { authorizationDeadline } from "@/lib/orders/authorization-deadline";

export interface AuthorizationCountdownProps {
  authorizedAt: string | undefined;
  alertHours: number;
  cancelHours: number;
  /** `AdminOrder.adminAlertedAt` — the sweep already warned once; shown as a suffix, not a separate badge. */
  adminAlertedAt?: string;
}

function describe(daysLeft: number, hoursLeft: number): string {
  if (daysLeft >= 1) {
    const days = Math.floor(daysLeft);
    return `faltan ${days} día${days === 1 ? "" : "s"}`;
  }
  const hours = Math.max(0, Math.ceil(hoursLeft));
  return `vence en ${hours} h`;
}

/**
 * The queue's core signal: how much time is left before
 * `order-authorization.job.ts` cancels the authorization on its own.
 * Returns nothing for an order that was never authorized — a `pending_payment`
 * order has no deadline to project (`authorizationDeadline` returns `null`).
 */
export function AuthorizationCountdown({
  authorizedAt,
  alertHours,
  cancelHours,
  adminAlertedAt,
}: AuthorizationCountdownProps) {
  const deadline = authorizationDeadline({ authorizedAt, alertHours, cancelHours });
  if (!deadline) return null;

  const label =
    deadline.level === "expired" ? "vencida, pendiente de barrido" : describe(deadline.daysLeft, deadline.hoursLeft);
  const variant = deadline.level === "ok" ? "neutral" : deadline.level === "critical" ? "advertencia" : "error";

  return <Badge variant={variant}>{label}{adminAlertedAt ? " · notificada" : ""}</Badge>;
}
