import { stubMailer } from "./stub.mailer.js";
import type { Mailer } from "./mailer.interface.js";

export type { Mailer };

/**
 * Only one adapter exists at this milestone. M7 turns this into a real
 * factory (env-selected adapter, stub as the no-credentials fallback);
 * M15 registers Resend. Callers only ever depend on `Mailer`, so neither
 * change touches `auth.service.ts`.
 */
export function createMailer(): Mailer {
  return stubMailer;
}
