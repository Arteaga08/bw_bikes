const UNIT_MS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/**
 * Converts M2's constrained `<integer><s|m|h|d>` duration format (see
 * `env.ts`'s `EXPIRES_IN_PATTERN`, which already guarantees this shape) to
 * milliseconds. Shared by cookie `maxAge` and refresh-session `expiresAt`
 * so both agree on exactly how long `JWT_REFRESH_EXPIRES_IN` means.
 */
export function parseDurationMs(duration: string): number {
  const unit = duration.at(-1) as string;
  const amount = Number(duration.slice(0, -1));
  return amount * UNIT_MS[unit]!;
}
