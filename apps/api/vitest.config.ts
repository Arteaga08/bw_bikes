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
      STOCK_RESERVATION_TTL_MINUTES: "30",
      // Deliberately tiny so the reaper's own test can observe a real tick in
      // milliseconds instead of faking timers — faking them would also stub the
      // ones the Mongo driver uses. The job only runs when a test starts it
      // explicitly; nothing else in the suite is affected.
      RESERVATION_REAPER_INTERVAL_MS: "50",
      RESERVATION_RETENTION_DAYS: "30",
    },
  },
});
