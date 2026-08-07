import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Two projects, split by what they need:
 *  - "node": pure logic (the session guard, the API client) — no DOM, no
 *    React plugin, fast.
 *  - "jsdom": components (forms, shell pieces) that render and fire events.
 *
 * Both share the `@/*` path alias via `tsconfigPaths` so tests import
 * exactly like application code does.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    projects: [
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        plugins: [tsconfigPaths(), react()],
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
