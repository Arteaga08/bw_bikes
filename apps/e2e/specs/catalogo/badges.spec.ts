import { test, expect } from "../../fixtures/auth.js";
import { expectToast } from "../../helpers/toast.js";

const ROUTE = "/admin/catalogo/badges";

/** Unique per call so parallel workers/runs never collide on the same label. */
function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

test.describe("Catálogo · Badges", () => {
  test("crea, edita y elimina un badge de principio a fin", async ({ page }) => {
    const originalLabel = uniqueName("E2E Badge");
    const editedLabel = uniqueName("E2E Badge Editado");

    await page.goto(ROUTE);

    // Crear
    await page.getByRole("button", { name: "Nuevo badge" }).click();
    const createDialog = page.getByRole("dialog", { name: "Nuevo badge" });
    await createDialog.getByLabel("Etiqueta").fill(originalLabel);
    await createDialog.getByLabel("Variante").selectOption("accent");
    await createDialog.getByRole("button", { name: "Guardar" }).click();
    await expectToast(page, "Badge creado");
    await expect(createDialog).toBeHidden();

    // La fila nueva aparece — filtrada por etiqueta para no depender de en
    // qué página de resultados cae entre corridas paralelas.
    await page.getByLabel("Buscar").fill(originalLabel);
    const row = page.getByRole("row", { name: originalLabel });
    await expect(row).toBeVisible();

    // Editar
    await row.getByRole("button", { name: "Editar" }).click();
    const editDialog = page.getByRole("dialog", { name: "Editar badge" });
    await editDialog.getByLabel("Etiqueta").fill(editedLabel);
    await editDialog.getByRole("button", { name: "Guardar" }).click();
    await expectToast(page, "Cambios guardados");
    await expect(editDialog).toBeHidden();

    await page.getByLabel("Buscar").fill(editedLabel);
    const editedRow = page.getByRole("row", { name: editedLabel });
    await expect(editedRow).toBeVisible();

    // Eliminar
    await editedRow.getByRole("button", { name: "Eliminar" }).click();
    const deleteDialog = page.getByRole("dialog", { name: "Eliminar badge" });
    await deleteDialog.getByRole("button", { name: "Sí, eliminar" }).click();
    await expectToast(page, "Badge eliminado");
    await expect(deleteDialog).toBeHidden();
    await expect(page.getByRole("row", { name: editedLabel })).toHaveCount(0);
  });

  test("cancelar en el modal de creación no crea ningún badge", async ({ page }) => {
    const label = uniqueName("E2E Badge Cancelado");

    await page.goto(ROUTE);
    await page.getByRole("button", { name: "Nuevo badge" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo badge" });
    await dialog.getByLabel("Etiqueta").fill(label);
    await dialog.getByLabel("Variante").selectOption("accent");
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();

    await page.getByLabel("Buscar").fill(label);
    await expect(page.getByRole("row", { name: label })).toHaveCount(0);
  });
});
