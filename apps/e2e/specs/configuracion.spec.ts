import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../fixtures/auth.js";
import { expectToast } from "../helpers/toast.js";

/**
 * `/admin/configuracion` — read before writing this:
 *  - `SettingsView.tsx` (six independent `<form>` sections, in order: Inventario, Órdenes, Precios, Envíos, Solicitudes, Tareas programadas)
 *  - `SettingsSectionCard.tsx` (each section is its own `<form>` with an `<h2>` title and its own "Guardar" button — so "Guardar" alone is ambiguous across the page)
 *  - `SettingsSections.tsx` (`parseInt` rejects anything that isn't `/^\d+$/`; on rejection every section toasts the same "Revisa los campos" / "Todos los valores deben ser enteros." pair — never an inline field error)
 */
test.describe("Configuración", () => {
  /** Each `SettingsSectionCard` is a `<form>` containing exactly one `<h2>` with the section title — scoping to it disambiguates "Guardar", which every section repeats. */
  function section(page: Page, title: string): Locator {
    return page.locator("form").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  }

  test("la pantalla carga y se ven las secciones de configuración", async ({ page }) => {
    await page.goto("/admin/configuracion");

    for (const title of ["Inventario", "Órdenes", "Precios", "Envíos", "Solicitudes", "Tareas programadas"]) {
      await expect(section(page, title)).toBeVisible();
      await expect(section(page, title).getByRole("button", { name: "Guardar" })).toBeVisible();
    }
  });

  test("guarda la sección de Inventario con un umbral válido", async ({ page }) => {
    await page.goto("/admin/configuracion");

    const inventario = section(page, "Inventario");
    await inventario.getByLabel("Umbral de stock bajo (unidades)").fill("15");
    await inventario.getByRole("button", { name: "Guardar" }).click();

    await expectToast(page, "Inventario actualizado");
  });

  test("un campo numérico con texto no numérico muestra el error de validación", async ({ page }) => {
    await page.goto("/admin/configuracion");

    const inventario = section(page, "Inventario");
    await inventario.getByLabel("Minutos de reserva por checkout").fill("no-es-un-numero");
    await inventario.getByRole("button", { name: "Guardar" }).click();

    // `parseInt` (SettingsSections.tsx) rejects with a toast, not an inline
    // field error — every numeric section shares this exact pair.
    await expectToast(page, "Revisa los campos");
    await expect(page.getByText("Todos los valores deben ser enteros.")).toBeVisible();
  });
});
