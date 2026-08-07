import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// @testing-library/react doesn't auto-register cleanup for Vitest the way
// it does for Jest — without this, every `render()` in a later `it()` piles
// its DOM on top of the previous one instead of starting fresh.
afterEach(() => {
  cleanup();
});
