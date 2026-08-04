import type { UserRole } from "@bw-bikes/shared";
import { connectDb, disconnectDb } from "../config/db.js";
import { logger } from "../config/logger.js";
import { User } from "../models/index.js";

/**
 * Idempotent seed for the very first admin account. Public registration
 * always creates a `customer` — the register validator never accepts a
 * `role` field (anti mass-assignment, see validate.ts) — so there is no API
 * path that can mint the first admin. Run once at initial setup:
 *
 *   SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... pnpm --filter @bw-bikes/api seed:admin
 *
 * Re-running it against an existing email updates that account (role,
 * password, forces `emailVerified: true`) instead of failing — the
 * intended way to rotate the first admin's credentials.
 *
 * The seeded/updated account always ends with `twoFactor.enabled: false`
 * — its next login is forced through the enrollment challenge (see
 * `protect` and `loginWithPassword`), never a bare password login.
 *
 * Doesn't go through `env.ts`'s fail-fast loader for the `SEED_ADMIN_*`
 * vars specifically: those are seed-only, not required for the server
 * itself to boot. `connectDb()` below still depends on the rest of
 * `env.ts` (MONGODB_URI, JWT_SECRET, ...), so this still needs to run
 * against a fully configured environment.
 */

const VALID_ROLES: readonly UserRole[] = ["admin", "superadmin"];

function fail(message: string): never {
  logger.error(`[seed-admin] ${message}`);
  process.exit(1);
}

async function run(): Promise<void> {
  const email = process.env["SEED_ADMIN_EMAIL"]?.trim().toLowerCase();
  const password = process.env["SEED_ADMIN_PASSWORD"];
  const roleInput = process.env["SEED_ADMIN_ROLE"]?.trim() || "admin";

  if (!email) fail("SEED_ADMIN_EMAIL is required.");
  if (!password || password.length < 8) {
    fail("SEED_ADMIN_PASSWORD is required and must be at least 8 characters.");
  }
  if (!VALID_ROLES.includes(roleInput as UserRole)) {
    fail(`SEED_ADMIN_ROLE must be one of ${VALID_ROLES.join(", ")} (got "${roleInput}").`);
  }
  const role = roleInput as UserRole;

  await connectDb();
  try {
    const existing = await User.findOne({ email }).select("+password");

    if (existing) {
      existing.password = password;
      existing.role = role;
      existing.emailVerified = true;
      existing.twoFactor = { enabled: false };
      await existing.save();
      logger.info(`[seed-admin] Updated existing admin: ${email} (role: ${role})`);
    } else {
      await User.create({
        email,
        password,
        firstName: "Admin",
        lastName: "Owner",
        role,
        emailVerified: true,
      });
      logger.info(`[seed-admin] Created admin: ${email} (role: ${role})`);
    }
  } finally {
    await disconnectDb();
  }
}

run().catch((error: unknown) => {
  logger.error({ err: error }, "[seed-admin] Failed to seed admin user.");
  process.exit(1);
});
