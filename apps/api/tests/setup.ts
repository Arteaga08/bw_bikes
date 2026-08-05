import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { resetTransactionSupport } from "../src/config/db.js";
import { resetRateLimiters } from "../src/middlewares/rate-limit.js";
import { resetSettingsCache } from "../src/services/settings.service.js";

/**
 * Shared DB fixture for the whole suite. Connects mongoose's default
 * connection to a real, in-memory MongoDB instance — models and services
 * run against real Mongo semantics (unique indexes, $expr, TTL) instead of
 * a mock, without needing a Mongo daemon on the dev machine or in CI.
 *
 * A **single-node replica set**, not a standalone server: Mongo only offers
 * multi-document transactions on a replica set, and `inventory.service.ts`
 * uses one to keep a reservation document and its inventory counter
 * consistent. Against a standalone the service silently takes its
 * compensating fallback path, so the code that production actually runs would
 * never be exercised. One node keeps startup cheap while still being a real
 * replica set.
 *
 * Registered once via `vitest.config.ts`'s `setupFiles`, so it runs before
 * every test file. `config/db.ts` / `connectDb()` are never invoked here —
 * `buildApp()` doesn't open a DB connection either (see app.ts), so the
 * only connection in the test process is the one this file opens directly.
 */
let mongod: MongoMemoryReplSet;

beforeAll(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(mongod.getUri());
  // The probe in config/db.ts caches per process; this file's connection is
  // brand new, so make sure it isn't answered from a previous run's cache.
  resetTransactionSupport();
}, 120_000); // first run downloads the mongod binary; give it room

afterEach(async () => {
  // Wipe every collection between tests so cases stay independent, without
  // paying the cost of tearing down and recreating the whole server.
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));

  // The login rate limiter is a real, stateful limiter in `test` (see
  // rate-limit.ts) — reset it so one test's lockout doesn't bleed into the
  // next.
  resetRateLimiters();

  // `settingsService` caches in-process with a 60s TTL (see
  // settings.service.ts). Without this, a test that mutated a section (or
  // simply triggered the lazy-create default) would leave that snapshot
  // cached in memory across the `deleteMany` above, so the *next* test would
  // silently read stale settings instead of the freshly-defaulted document
  // Mongo actually holds.
  resetSettingsCache();

  // Restores any mailer spy set up via tests/helpers/mailer.ts.
  vi.restoreAllMocks();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
