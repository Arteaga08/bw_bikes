import pino from "pino";
import { env } from "./env.js";

/**
 * Structured logger. `debug` is silenced outside development, and known
 * PII/secret-bearing keys are redacted regardless of where they appear in the
 * log payload — never log passwords, tokens, connection strings, or full
 * third-party payloads.
 */
export const logger = pino({
  level: env.isProduction ? "info" : "debug",
  redact: {
    paths: [
      "password",
      "*.password",
      "req.headers.cookie",
      "req.headers.authorization",
      "token",
      "*.token",
      "secret",
      "*.secret",
      "twoFactor.secret",
      "*.twoFactor.secret",
      // Fiscal id (M7's optional CFDI `BillingInfo`) — a government-issued
      // identifier, same category as any other PII this logger already keeps
      // out of the log stream.
      "rfc",
      "*.rfc",
      "billingInfo.rfc",
      "*.billingInfo.rfc",
    ],
    censor: "[redacted]",
  },
  transport: env.isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
      },
});
