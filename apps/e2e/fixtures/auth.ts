import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test as base } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const NONSUPER_STORAGE_STATE = resolve(HERE, "..", ".auth", "admin-nonsuper.json");

interface AuthFixtures {
  /**
   * A second admin session (role `admin`, not `superadmin`) — only for the
   * Auditoría spec, which needs to prove the UI hides the nav link and
   * blocks the route for a role Sesión 1 already proved the backend rejects.
   * Every other spec uses the default `page`, authenticated as the
   * superadmin via `playwright.config.ts`'s `use.storageState`.
   */
  nonSuperAdminPage: import("@playwright/test").Page;
}

export const test = base.extend<AuthFixtures>({
  nonSuperAdminPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: NONSUPER_STORAGE_STATE });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";
