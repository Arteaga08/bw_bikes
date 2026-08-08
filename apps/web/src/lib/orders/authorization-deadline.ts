const MS_PER_HOUR = 3_600_000;

export type AuthorizationDeadlineLevel = "ok" | "critical" | "expired";

export interface AuthorizationDeadline {
  /** When the background sweep (`order-authorization.job.ts`) will cancel the authorization. */
  cancelAt: Date;
  /** When the sweep already sent (or will send) the admin alert. */
  alertAt: Date;
  msLeft: number;
  daysLeft: number;
  hoursLeft: number;
  level: AuthorizationDeadlineLevel;
}

export interface AuthorizationDeadlineInput {
  /** `order.payment.authorizedAt` — the clock the backend sweep actually reads, not `createdAt`. */
  authorizedAt: string | undefined;
  alertHours: number;
  cancelHours: number;
  now?: Date;
}

/**
 * Pure projection of `alertThreshold`/`cancelThreshold`
 * (`apps/api/src/services/order.service.ts`), run forward from
 * `payment.authorizedAt` instead of backward from "now" — the job checks
 * "has enough time passed since authorization", this answers "how much time
 * is left", which is what the queue's countdown badge needs.
 *
 * `null` when the order was never authorized (no `on_request`/`preorder`
 * line ever went through Stripe's manual-capture path) — there's no
 * authorization clock to project.
 */
export function authorizationDeadline(input: AuthorizationDeadlineInput): AuthorizationDeadline | null {
  if (!input.authorizedAt) return null;

  const authorizedAt = new Date(input.authorizedAt);
  const now = input.now ?? new Date();
  const alertAt = new Date(authorizedAt.getTime() + input.alertHours * MS_PER_HOUR);
  const cancelAt = new Date(authorizedAt.getTime() + input.cancelHours * MS_PER_HOUR);
  const msLeft = cancelAt.getTime() - now.getTime();

  let level: AuthorizationDeadlineLevel;
  if (msLeft <= 0) {
    level = "expired";
  } else if (now.getTime() >= alertAt.getTime()) {
    level = "critical";
  } else {
    level = "ok";
  }

  return {
    cancelAt,
    alertAt,
    msLeft,
    daysLeft: msLeft / (MS_PER_HOUR * 24),
    hoursLeft: msLeft / MS_PER_HOUR,
    level,
  };
}
