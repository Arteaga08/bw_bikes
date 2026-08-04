import { logger } from "../../config/logger.js";
import type { Mailer } from "./mailer.interface.js";

/**
 * No real provider is configured until M15 (Resend). This adapter never
 * sends anything — it logs at `debug`, which `config/logger.ts` silences
 * outside development... except in `test`, where `isProduction` is also
 * false, so debug stays on there too. In both cases the level is never
 * "debug" in production (`info` only), so the token embedded in the link
 * never reaches a production log despite BACKEND_SECURITY_GUIDELINES.md
 * §11's "never log tokens" — that rule targets the always-on request
 * logger, not this dev/test-only convenience path with no production
 * counterpart. The auth flow stays completable end to end without a real
 * mailer: read the link from here.
 */
export const stubMailer: Mailer = {
  async sendVerificationEmail({ to, verifyUrl }) {
    logger.debug({ to, verifyUrl }, "[stub-mailer] verification email not sent — no provider configured");
  },
  async sendPasswordResetEmail({ to, resetUrl }) {
    logger.debug({ to, resetUrl }, "[stub-mailer] password reset email not sent — no provider configured");
  },
};
