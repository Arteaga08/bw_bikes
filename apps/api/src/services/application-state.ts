import type { ApplicationStatus } from "@bw-bikes/shared";
import { AppError } from "../utils/index.js";

/**
 * The ambassador/sponsorship application lifecycle. Deliberately its own
 * table, separate from `order-state.ts` — a different domain with a much
 * simpler shape (one open state, two terminal outcomes) — but the same
 * pattern: transitions are data, not scattered conditionals, and nothing
 * writes `status` without checking here first (`application.service.ts`).
 *
 *   pending ──► approved
 *   pending ──► rejected
 */
const APPLICATION_TRANSITIONS: Readonly<Record<ApplicationStatus, readonly ApplicationStatus[]>> = Object.freeze({
  pending: ["approved", "rejected"],
  approved: [],
  rejected: [],
});

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: "pendiente",
  approved: "aprobada",
  rejected: "rechazada",
};

function isTerminal(status: ApplicationStatus): boolean {
  return APPLICATION_TRANSITIONS[status].length === 0;
}

function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return APPLICATION_TRANSITIONS[from].includes(to);
}

function assertTransition(from: ApplicationStatus, to: ApplicationStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError(
      `No se puede pasar una solicitud de "${STATUS_LABELS[from]}" a "${STATUS_LABELS[to]}".`,
      409,
    );
  }
}

export { APPLICATION_TRANSITIONS, assertTransition, canTransition, isTerminal };
