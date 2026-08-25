import { test, expect } from "../../fixtures/auth.js";
import { expectToast } from "../../helpers/toast.js";

const ROUTE = "/admin/catalogo/colores";

/** Unique per call so parallel workers/runs never collide on the same value. */
function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

test.describe("Catálogo · Colores", () => {
  test("crea, edita y elimina un color de principio a fin", async ({ page }) => {
    const originalValue = uniqueName("E2E Color");
    const editedValue = uniqueName("E2E Color Editado");

    await page.goto(ROUTE);

    // Crear — `HexPicker` also renders a curated swatch grid, but the plain
    // text fallback input (`"Hex (código hex)"`, visually hidden label) is
    // the simplest, most stable way to drive it from Playwright.
    await page.getByRole("button", { name: "Nuevo color" }).click();
    const createDialog = page.getByRole("dialog", { name: "Nuevo color" });
    await createDialog.getByLabel("Color", { exact: true }).fill(originalValue);
    await createDialog.getByLabel("Hex (código hex)").fill("#1E90FF");
    await createDialog.getByRole("button", { name: "Guardar" }).click();
    await expectToast(page, "Color creado");
    await expect(createDialog).toBeHidden();

    // La fila nueva aparece — filtrada por nombre para no depender de en qué
    // página de resultados cae entre corridas paralelas.
    await page.getByLabel("Buscar").fill(originalValue);
    const row = page.getByRole("row", { name: originalValue });
    await expect(row).toBeVisible();

    // Editar
    await row.getByRole("button", { name: "Editar" }).click();
    const editDialog = page.getByRole("dialog", { name: "Editar color" });
    await editDialog.getByLabel("Color", { exact: true }).fill(editedValue);
    await editDialog.getByLabel("Hex (código hex)").fill("#FF4500");
    await editDialog.getByRole("button", { name: "Guardar" }).click();
    await expectToast(page, "Cambios guardados");
    await expect(editDialog).toBeHidden();

    await page.getByLabel("Buscar").fill(editedValue);
    const editedRow = page.getByRole("row", { name: editedValue });
    await expect(editedRow).toBeVisible();

    // Eliminar
    await editedRow.getByRole("button", { name: "Eliminar" }).click();
    const deleteDialog = page.getByRole("dialog", { name: "Eliminar color" });
    await deleteDialog.getByRole("button", { name: "Sí, eliminar" }).click();
    await expectToast(page, "Color eliminado");
    await expect(deleteDialog).toBeHidden();
    await expect(page.getByRole("row", { name: editedValue })).toHaveCount(0);
  });

  test("cancelar en el modal de creación no crea ningún color", async ({ page }) => {
    const value = uniqueName("E2E Color Cancelado");

    await page.goto(ROUTE);
    await page.getByRole("button", { name: "Nuevo color" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo color" });
    await dialog.getByLabel("Color", { exact: true }).fill(value);
    await dialog.getByLabel("Hex (código hex)").fill("#1E90FF");
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();

    await page.getByLabel("Buscar").fill(value);
    await expect(page.getByRole("row", { name: value })).toHaveCount(0);
  });
});
