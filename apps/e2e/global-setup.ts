import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { request as playwrightRequest } from "@playwright/test";
import { generate } from "otplib";
import { apiEnv } from "./playwright.config.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const ENV_FILE = resolve(HERE, ".env.e2e.local");
const AUTH_DIR = resolve(HERE, ".auth");
const WEB_ORIGIN = "http://localhost:3000";
const API_ADMIN_BASE = "/api/v1/admin";

const SUPERADMIN_PASSWORD = process.env["E2E_ADMIN_PASSWORD"] ?? "";
const SUPERADMIN_EMAIL = process.env["E2E_ADMIN_EMAIL"] ?? "";
const NONSUPER_EMAIL = process.env["E2E_ADMIN_NONSUPER_EMAIL"] ?? "";
const NONSUPER_PASSWORD = process.env["E2E_ADMIN_NONSUPER_PASSWORD"] ?? "";

/**
 * Runs one of `apps/api`'s own `tsx` scripts as a child process, pointed at
 * the same fixed e2e Mongo the already-running `apps/api` `webServer` entry
 * uses (Mongo accepts many concurrent client connections, so this is safe).
 * `seed-admin.ts`/`seed-e2e-orders.ts` are the same scripts a human would
 * run by hand — nothing here reimplements them.
 */
function runApiScript(scriptRelativePath: string, extraEnv: Record<string, string> = {}): void {
  execFileSync("pnpm", ["--filter", "@bw-bikes/api", "exec", "tsx", scriptRelativePath], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...apiEnv, ...extraEnv },
    stdio: "inherit",
  });
}

/**
 * Persists a freshly-enrolled TOTP secret back into `.env.e2e.local` so the
 * *next* run of the suite verifies against the already-enrolled account
 * instead of re-enrolling (the backend has no bypass — see the plan's own
 * notes on why re-running `seed:admin` against this email would force a new
 * enrollment).
 */
function persistTotpSecret(varName: string, secret: string): void {
  const content = readFileSync(ENV_FILE, "utf-8");
  const line = `${varName}=${secret}`;
  const pattern = new RegExp(`^${varName}=.*$`, "m");
  const updated = pattern.test(content) ? content.replace(pattern, line) : `${content}\n${line}\n`;
  writeFileSync(ENV_FILE, updated);
  process.env[varName] = secret;
}

interface LoginResult {
  storageStatePath: string;
}

/**
 * Logs an admin in against `apps/web`'s own origin (not the API's port
 * directly) so the `Set-Cookie` the browser later reuses via `storageState`
 * is scoped to the origin the browser will actually visit — mirrors
 * `apps/api/tests/helpers/admin-session.ts`'s "no shortcut" reasoning, just
 * over real HTTP instead of `supertest`.
 */
async function loginAdmin(params: {
  email: string;
  password: string;
  totpSecretVarName: string;
  storageStateFile: string;
}): Promise<LoginResult> {
  const ctx = await playwrightRequest.newContext({ baseURL: WEB_ORIGIN });

  await ctx.post("/api/v1/auth/login", { data: { email: params.email, password: params.password } });

  const existingSecret = process.env[params.totpSecretVarName];
  if (existingSecret) {
    const totpCode = await generate({ secret: existingSecret });
    const verifyRes = await ctx.post("/api/v1/auth/2fa/verify", { data: { totpCode } });
    if (!verifyRes.ok()) {
      throw new Error(
        `[global-setup] /2fa/verify failed for ${params.email} (${verifyRes.status()}). ` +
          `The stored ${params.totpSecretVarName} may be stale — clear it from .env.e2e.local and re-run.`,
      );
    }
  } else {
    const startRes = await ctx.post("/api/v1/auth/2fa/enroll/start");
    const startBody = (await startRes.json()) as { data: { secret: string } };
    const secret = startBody.data.secret;

    const totpCode = await generate({ secret });
    const completeRes = await ctx.post("/api/v1/auth/2fa/enroll/complete", { data: { totpCode } });
    if (!completeRes.ok()) {
      throw new Error(`[global-setup] /2fa/enroll/complete failed for ${params.email} (${completeRes.status()}).`);
    }

    persistTotpSecret(params.totpSecretVarName, secret);
  }

  const storageStatePath = resolve(AUTH_DIR, params.storageStateFile);
  await ctx.storageState({ path: storageStatePath });
  await ctx.dispose();
  return { storageStatePath };
}

/** One authenticated POST, used only to seed the small set of foundational catalog entities below. */
async function seedCatalogFixture(
  ctx: Awaited<ReturnType<typeof playwrightRequest.newContext>>,
  path: string,
  data: Record<string, unknown>,
): Promise<void> {
  const res = await ctx.post(`${API_ADMIN_BASE}${path}`, { data });
  // 409 = already exists from a previous run against a Mongo that wasn't
  // wiped (e.g. a developer reusing `reuseExistingServer` locally) — every
  // other non-2xx is a real failure worth stopping the whole setup for.
  if (!res.ok() && res.status() !== 409) {
    throw new Error(`[global-setup] POST ${path} failed (${res.status()}): ${await res.text()}`);
  }
}

async function seedFoundationalCatalogFixtures(storageStatePath: string): Promise<void> {
  const ctx = await playwrightRequest.newContext({ baseURL: WEB_ORIGIN, storageState: storageStatePath });

  // One of each, so the "Productos" (Bicicletas/Accesorios) create-flow specs
  // never hit an empty dropdown. Each catalog spec (Marcas/Tallas/Colores/
  // Fichas técnicas/...) creates and deletes its own throwaway entities on
  // top of this baseline — these are never touched or asserted on directly.
  await seedCatalogFixture(ctx, "/bike-size-templates", { value: "E2E-M", order: 0 });
  await seedCatalogFixture(ctx, "/accessory-size-templates", { value: "E2E-U", order: 0 });
  await seedCatalogFixture(ctx, "/color-templates", { value: "E2E Negro", hex: "#111111", order: 0 });
  await seedCatalogFixture(ctx, "/spec-templates", {
    title: "E2E Ficha técnica",
    fields: [{ label: "Peso", order: 0 }],
    order: 0,
  });

  await ctx.dispose();
}

export default async function globalSetup(): Promise<void> {
  mkdirSync(AUTH_DIR, { recursive: true });

  if (!SUPERADMIN_EMAIL || !SUPERADMIN_PASSWORD || !NONSUPER_EMAIL || !NONSUPER_PASSWORD) {
    throw new Error("[global-setup] E2E_ADMIN_*/E2E_ADMIN_NONSUPER_* must be set in apps/e2e/.env.e2e.local.");
  }

  runApiScript("src/scripts/seed-admin.ts", {
    SEED_ADMIN_EMAIL: SUPERADMIN_EMAIL,
    SEED_ADMIN_PASSWORD: SUPERADMIN_PASSWORD,
    SEED_ADMIN_ROLE: "superadmin",
  });
  runApiScript("src/scripts/seed-admin.ts", {
    SEED_ADMIN_EMAIL: NONSUPER_EMAIL,
    SEED_ADMIN_PASSWORD: NONSUPER_PASSWORD,
    SEED_ADMIN_ROLE: "admin",
  });

  const superadmin = await loginAdmin({
    email: SUPERADMIN_EMAIL,
    password: SUPERADMIN_PASSWORD,
    totpSecretVarName: "E2E_ADMIN_TOTP_SECRET",
    storageStateFile: "admin.json",
  });
  await loginAdmin({
    email: NONSUPER_EMAIL,
    password: NONSUPER_PASSWORD,
    totpSecretVarName: "E2E_ADMIN_NONSUPER_TOTP_SECRET",
    storageStateFile: "admin-nonsuper.json",
  });

  await seedFoundationalCatalogFixtures(superadmin.storageStatePath);

  // Orders last: it creates/consumes real Stripe test-mode PaymentIntents and
  // needs the catalog (brand/categories/products) that either this file or
  // the script's own `upsertCatalog()` already ensured exists.
  runApiScript("src/scripts/seed-e2e-orders.ts");
}
