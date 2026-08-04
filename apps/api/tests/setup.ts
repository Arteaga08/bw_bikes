import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { resetRateLimiters } from "../src/middlewares/rate-limit.js";

/**
 * Shared DB fixture for the whole suite. Connects mongoose's default
 * connection to a real, in-memory MongoDB instance — models and services
 * run against real Mongo semantics (unique indexes, $expr, TTL) instead of
 * a mock, without needing a Mongo daemon on the dev machine or in CI.
 *
 * Registered once via `vitest.config.ts`'s `setupFiles`, so it runs before
 * every test file. `config/db.ts` / `connectDb()` are never invoked here —
 * `buildApp()` doesn't open a DB connection either (see app.ts), so the
 * only connection in the test process is the one this file opens directly.
 */
let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}, 60_000); // first run downloads the mongod binary; give it room

afterEach(async () => {
  // Wipe every collection between tests so cases stay independent, without
  // paying the cost of tearing down and recreating the whole server.
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));

  // The login rate limiter is a real, stateful limiter in `test` (see
  // rate-limit.ts) — reset it so one test's lockout doesn't bleed into the
  // next.
  resetRateLimiters();

  // Restores any mailer spy set up via tests/helpers/mailer.ts.
  vi.restoreAllMocks();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
