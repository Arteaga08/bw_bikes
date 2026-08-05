import { defineConfig } from "vitest/config";

// Test env vars are injected here rather than via a committed .env.test file —
// per BACKEND_SECURITY_GUIDELINES.md §9 only *.example files are versioned.
// These are fixture values with no real-world validity, scoped to the test run.
export default defineConfig({
  test: {
    environment: "node",
    // Real Mongo, not a mock: tests/setup.ts starts an in-memory
    // mongodb-memory-server instance and connects mongoose to it directly.
    // MONGODB_URI below is an inert fixture — it only exists so env.ts's
    // fail-fast check passes; buildApp() never calls connectDb() (see M1),
    // so nothing actually dials this address.
    setupFiles: ["./tests/setup.ts"],
    // Above vitest's 5s default: several suites drive real bcrypt (cost 12,
    // a deliberate security parameter — see config/auth.ts) through multiple
    // sequential login attempts, and every test file gets its own
    // MongoMemoryReplSet. Running the whole suite in parallel (28+ files,
    // each spinning up a replica set and an HTTP server) contends for CPU
    // enough that a handful of these occasionally miss a 5s deadline despite
    // doing nothing wrong — a different test trips it each run, which is the
    // signature of a scheduling/contention ceiling, not a hung request. Any
    // genuinely stuck request still fails well before this.
    testTimeout: 20_000,
    env: {
      NODE_ENV: "test",
      PORT: "4001",
      MONGODB_URI: "mongodb://127.0.0.1:27017/bw_bikes_test",
      JWT_SECRET: "test-jwt-secret-fixture-at-least-48-characters-000000",
      ENCRYPTION_KEY: "test-encryption-key-fixture-at-least-48-characters-0",
      CLIENT_URL: "http://localhost:3000",
      JWT_ACCESS_EXPIRES_IN: "15m",
      JWT_REFRESH_EXPIRES_IN: "30d",
      // Inert Cloudinary fixtures: env.ts requires them, and config/cloudinary.ts
      // hands them to the SDK, but no test ever lets a request reach the network
      // — tests/helpers/cloudinary.ts stubs the uploader, and the magic-bytes
      // rejection path short-circuits before the SDK is even called.
      CLOUDINARY_CLOUD_NAME: "test-cloud",
      CLOUDINARY_API_KEY: "000000000000000",
      CLOUDINARY_API_SECRET: "test-cloudinary-api-secret-fixture",
      // Inert Stripe fixtures. The secret key never reaches the network:
      // tests/helpers/stripe.ts replaces the provider's SDK calls with spies.
      // The webhook secret, by contrast, is used **for real** — the suite signs
      // its own payloads with `stripe.webhooks.generateTestHeaderString` so the
      // signature-verification path is exercised exactly as in production
      // rather than stubbed away.
      STRIPE_SECRET_KEY: "sk_test_fixture000000000000000000000000",
      STRIPE_WEBHOOK_SECRET: "whsec_test_fixture0000000000000000000000",
      STRIPE_WEBHOOK_TOLERANCE_SECONDS: "300",
      // Every other threshold that used to be seeded here (reservation TTLs,
      // order authorization windows, tax rate, shipping fees, the
      // application cooldown, and the three job intervals) moved to the
      // `Settings` singleton in M7 — see config/settings.defaults.ts. Their
      // defaults there equal the values that used to live here, so no test
      // needed to change its expectations; tests that specifically need a
      // short job interval (for observing a real timer tick) now seed
      // `Settings.jobs` directly via `settingsService.updateSection`.
    },
  },
});
