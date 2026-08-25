import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Matches `apps/web/src/components/ui/Toast.tsx`'s own contract: every toast
 * is `role="status"` inside an `aria-live="polite"` container, title text in
 * the first `<p>`. No third-party toast library, no `data-testid` — this is
 * the same shape the app's own component tests already assert against.
 */
export async function expectToast(page: Page, title: string | RegExp): Promise<void> {
  await expect(page.getByRole("status").filter({ hasText: title }).first()).toBeVisible();
}

/**
 * Every network-error toast in this app follows one shape: a fixed
 * `"No se pudo <verbo>"` title with a description that echoes the backend's
 * message verbatim, or falls back to `"Intenta de nuevo."`. Callers only
 * need to know the fixed title.
 */
export async function expectErrorToast(page: Page, title: string | RegExp): Promise<void> {
  await expectToast(page, title);
}
