import { expect, test } from "../fixtures/auth.js";

/**
 * `/admin` (root of the panel) — read before writing this:
 *  - `apps/web/src/app/admin/(panel)/page.tsx` (renders `QuickLinks`, `OperationsStrip`, `HomeStats`)
 *  - `QuickLinks.tsx` (three `Link`s: "Catálogo" → /admin/catalogo, "Inventario" → /admin/inventario, "Solicitudes" → /admin/solicitudes)
 *  - `RecentOrdersList.tsx` ("Órdenes recientes" card, one row per seeded order)
 *  - `components/shell/TopBar.tsx` + `NotificationsPopover.tsx` (bell: `aria-label` starts with "Notificaciones")
 */
test.describe("Inicio", () => {
  test("carga sin errores de consola", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/admin");

    await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("los quick links navegan a la sección esperada", async ({ page }) => {
    const links: Array<{ name: string; url: RegExp }> = [
      { name: "Catálogo", url: /\/admin\/catalogo/ },
      { name: "Inventario", url: /\/admin\/inventario/ },
      { name: "Solicitudes", url: /\/admin\/solicitudes/ },
    ];

    // Scoped to `<main id="panel-content">`: the sidebar ((panel)/layout.tsx's
    // `Sidebar`) has its own "Inventario"/"Solicitudes" nav links with the
    // exact same accessible name — an unscoped locator would be ambiguous.
    const main = page.getByRole("main");

    for (const link of links) {
      await page.goto("/admin");
      await main.getByRole("link", { name: new RegExp(`^${link.name}`) }).click();
      await expect(page).toHaveURL(link.url);
      await page.goBack();
    }
  });

  test("el popover de notificaciones abre sin error", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/admin");
    const bell = page.getByRole("button", { name: /^Notificaciones/ });
    await bell.click();
    await expect(bell).toHaveAttribute("aria-expanded", "true");

    expect(pageErrors).toEqual([]);
  });

  test("la lista de órdenes recientes muestra al menos una fila", async ({ page }) => {
    await page.goto("/admin");

    await expect(page.getByText("Órdenes recientes", { exact: true })).toBeVisible();
    await expect(page.getByText("Sin órdenes todavía.")).not.toBeVisible();
  });
});
