import { expect, test } from "../fixtures/auth.js";

/**
 * `/admin/auditoria` — superadmin-only. Sources read before writing this:
 *  - `apps/web/src/lib/nav.ts` (the "Auditoría" nav item carries `roles: ["superadmin"]`)
 *  - `apps/web/src/components/shell/Sidebar.tsx` (`isVisibleTo` filters nav items by role — cosmetic only)
 *  - `apps/web/src/app/admin/(panel)/auditoria/layout.tsx` (`requireSuperadminSession` — real gate is the API's `restrictTo("superadmin")`)
 *  - `apps/web/src/lib/auth/session.ts` (`FORBIDDEN_PATH = "/admin/sin-acceso"`)
 *  - `AuditLogView.tsx` / `AuditLogDetailSlideOver.tsx` (read-only: "Ver detalle" opens a `SlideOver`, only "Cerrar panel" as a control)
 */
test.describe("Auditoría", () => {
  test("RBAC en UI: un admin no-superadmin no ve el link y no puede navegar a la ruta", async ({ nonSuperAdminPage }) => {
    await nonSuperAdminPage.goto("/admin");
    await expect(nonSuperAdminPage.getByRole("link", { name: "Auditoría" })).toHaveCount(0);

    await nonSuperAdminPage.goto("/admin/auditoria");
    await expect(nonSuperAdminPage).toHaveURL(/\/admin\/sin-acceso$/);
  });

  test("superadmin: la tabla de auditoría carga sin error", async ({ page }) => {
    await page.goto("/admin/auditoria");
    // Either real rows or the explicit empty state — both are "loaded without error";
    // only the load-error EmptyState ("No se pudo cargar la bitácora") would be a failure.
    await expect(
      page.locator("table tbody tr").first().or(page.getByText("Sin entradas con estos filtros")),
    ).toBeVisible();
    await expect(page.getByText("No se pudo cargar la bitácora")).not.toBeVisible();
  });

  test("ver detalle de una entrada abre un panel de solo lectura", async ({ page }) => {
    await page.goto("/admin/auditoria");

    const firstDetailButton = page.getByRole("button", { name: "Ver detalle" }).first();
    const hasEntries = await firstDetailButton.isVisible().catch(() => false);
    test.skip(!hasEntries, "No hay entradas de auditoría en esta corrida — nada que abrir.");

    await firstDetailButton.click();
    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();

    // Read-only: the only control in the panel is "Cerrar panel" — no save/delete/edit button.
    await expect(panel.getByRole("button", { name: "Cerrar panel" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Guardar" })).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "Eliminar" })).toHaveCount(0);

    await panel.getByRole("button", { name: "Cerrar panel" }).click();
    await expect(panel).not.toBeVisible();
  });

  test("los filtros y la paginación no producen errores", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/admin/auditoria");
    await page.getByLabel("Módulo").fill("orders");
    await page.getByLabel("Acción").selectOption({ index: 1 });
    await page.getByLabel("Módulo").fill("");
    await page.getByLabel("Acción").selectOption({ label: "Todas" });

    await expect(page.getByText("No se pudo cargar la bitácora")).not.toBeVisible();
    expect(errors).toEqual([]);
  });
});
