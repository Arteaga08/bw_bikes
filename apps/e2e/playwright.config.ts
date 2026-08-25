import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";
import { config as loadDotenv } from "dotenv";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = resolve(HERE, ".env.e2e.local");

if (!existsSync(ENV_FILE)) {
  throw new Error(
    `[playwright.config] Falta ${ENV_FILE}. Copia .env.e2e.local.example a .env.e2e.local y completa las ` +
      "credenciales de Stripe/Cloudinary test-mode (ver los comentarios de ese archivo).",
  );
}
loadDotenv({ path: ENV_FILE });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[playwright.config] Falta ${name} en apps/e2e/.env.e2e.local`);
  return value;
}

// Debe coincidir exactamente con PORT/DB_NAME en
// apps/api/src/scripts/e2e-mongo.ts — no se importa cruzando de paquete
// porque apps/api no se consume como librería en este monorepo.
const E2E_MONGO_URI = "mongodb://127.0.0.1:27117/bw_bikes_e2e";
const API_PORT = 4000;
const WEB_PORT = 3000;

// No son secretos reales: la base de datos que firman (mongodb-memory-server)
// es efímera y se tira al final de cada corrida. Fijos aquí para que la
// suite no dependa de un tercer par de credenciales que Manuel tendría que
// gestionar — a diferencia de Stripe/Cloudinary, nada aquí sale de este
// proceso.
const E2E_JWT_SECRET = "e2e-suite-jwt-secret-ephemeral-db-not-a-real-secret";
const E2E_ENCRYPTION_KEY = "e2e-suite-encryption-key-ephemeral-db-not-a-real-secret";

const apiEnv = {
  NODE_ENV: "development",
  PORT: String(API_PORT),
  MONGODB_URI: E2E_MONGO_URI,
  JWT_SECRET: E2E_JWT_SECRET,
  ENCRYPTION_KEY: E2E_ENCRYPTION_KEY,
  CLIENT_URL: `http://localhost:${WEB_PORT}`,
  JWT_ACCESS_EXPIRES_IN: "15m",
  JWT_REFRESH_EXPIRES_IN: "30d",
  STRIPE_SECRET_KEY: required("STRIPE_SECRET_KEY"),
  STRIPE_WEBHOOK_SECRET: required("STRIPE_WEBHOOK_SECRET"),
  CLOUDINARY_CLOUD_NAME: required("CLOUDINARY_CLOUD_NAME"),
  CLOUDINARY_API_KEY: required("CLOUDINARY_API_KEY"),
  CLOUDINARY_API_SECRET: required("CLOUDINARY_API_SECRET"),
};

/**
 * `webServer` as an ordered array (Playwright waits for each `port` to
 * answer before starting the next): an ephemeral single-node Mongo replica
 * set, then `apps/api` pointed at it, then `apps/web`'s production build.
 * See `global-setup.ts` for the admin/2FA/order seeding that runs once all
 * three are up.
 *
 * `apps/web` runs a **production build**, not `next dev`: avoids React 19
 * Strict Mode's dev-only double-invocation of effects, which can double
 * fire an API call mid-test and make an assertion flaky for a reason that
 * has nothing to do with the feature under test — same reasoning Session 2
 * used for its Lighthouse runs.
 */
export default defineConfig({
  testDir: "./specs",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 1 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  globalSetup: "./global-setup.ts",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    storageState: "./.auth/admin.json",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "pnpm --filter @bw-bikes/api e2e:mongo",
      port: 27117,
      reuseExistingServer: !process.env["CI"],
      timeout: 60_000,
    },
    {
      command: "pnpm --filter @bw-bikes/api dev",
      port: API_PORT,
      env: apiEnv,
      reuseExistingServer: !process.env["CI"],
      timeout: 60_000,
    },
    {
      command: "pnpm --filter @bw-bikes/web build && pnpm --filter @bw-bikes/web start",
      port: WEB_PORT,
      env: { API_URL: `http://localhost:${API_PORT}` },
      reuseExistingServer: !process.env["CI"],
      timeout: 180_000,
    },
  ],
});

export { apiEnv, E2E_MONGO_URI };
