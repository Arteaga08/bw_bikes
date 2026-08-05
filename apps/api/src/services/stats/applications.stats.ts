import type { ApplicationsStats, StatsRange } from "@bw-bikes/shared";
import { Application } from "../../models/index.js";

/**
 * `submitted` is windowed by `createdAt` (when the application arrived).
 * `approved`/`rejected` are windowed by *when the decision happened*, not by
 * submission date — an application filed last month and approved this week
 * belongs in this week's "approved" count. Approval leaves no dedicated
 * timestamp field (only `status` changes), so `updatedAt` stands in for it —
 * correct here because nothing else ever mutates an approved document.
 * Rejection does have its own field (`rejectedAt`, set by `application.service.ts`'s
 * `reject`), used directly.
 */
export async function getApplicationsStats(range: StatsRange): Promise<ApplicationsStats> {
  const from = new Date(range.from);
  const to = new Date(range.to);

  const [submitted, approved, rejected] = await Promise.all([
    Application.countDocuments({ createdAt: { $gte: from, $lt: to } }).exec(),
    Application.countDocuments({ status: "approved", updatedAt: { $gte: from, $lt: to } }).exec(),
    Application.countDocuments({ status: "rejected", rejectedAt: { $gte: from, $lt: to } }).exec(),
  ]);

  return { range, submitted, approved, rejected };
}
