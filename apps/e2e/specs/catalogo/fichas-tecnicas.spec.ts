import { test, expect } from "../../fixtures/auth.js";
import { expectToast } from "../../helpers/toast.js";

const ROUTE = "/admin/catalogo/fichas-tecnicas";

/** Unique per call so parallel workers/runs never collide on the same title. */
function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

test.describe("Catálogo · Fichas técnicas", () => {
  test("crea, edita y elimina una plantilla de principio a fin", async ({ page }) => {
    const originalTitle = uniqueName("E2E Ficha");
    const editedTitle = uniqueName("E2E Ficha Editada");

    await page.goto(ROUTE);

    // Crear — el título más un campo dinámico agregado vía "Nueva etiqueta" +
    // "Agregar etiqueta" (`SpecTemplateFormModal`'s `fields` list).
    await page.getByRole("button", { name: "Nueva plantilla" }).click();
    const createDialog = page.getByRole("dialog", { name: "Nueva plantilla" });
    await createDialog.getByLabel("Título").fill(originalTitle);
    await createDialog.getByLabel("Nueva etiqueta").fill("Peso");
    await createDialog.getByRole("button", { name: "Agregar etiqueta" }).click();
    await expect(createDialog.getByLabel("Etiqueta", { exact: true })).toHaveValue("Peso");
    await createDialog.getByRole("button", { name: "Guardar" }).click();
    await expectToast(page, "Plantilla creada");
    await expect(createDialog).toBeHidden();

    // La fila nueva aparece — filtrada por título para no depender de en qué
    // página de resultados cae entre corridas paralelas.
    await page.getByLabel("Buscar").fill(originalTitle);
    const row = page.getByRole("row", { name: originalTitle });
    await expect(row).toBeVisible();

    // Editar
    await row.getByRole("button", { name: "Editar" }).click();
    const editDialog = page.getByRole("dialog", { name: "Editar plantilla" });
    await expect(editDialog.getByLabel("Etiqueta", { exact: true })).toHaveValue("Peso");
    await editDialog.getByLabel("Título").fill(editedTitle);
    await editDialog.getByRole("button", { name: "Guardar" }).click();
    await expectToast(page, "Cambios guardados");
    await expect(editDialog).toBeHidden();

    await page.getByLabel("Buscar").fill(editedTitle);
    const editedRow = page.getByRole("row", { name: editedTitle });
    await expect(editedRow).toBeVisible();

    // Eliminar
    await editedRow.getByRole("button", { name: "Eliminar" }).click();
    const deleteDialog = page.getByRole("dialog", { name: "Eliminar plantilla" });
    await deleteDialog.getByRole("button", { name: "Sí, eliminar" }).click();
    await expectToast(page, "Plantilla eliminada");
    await expect(deleteDialog).toBeHidden();
    await expect(page.getByRole("row", { name: editedTitle })).toHaveCount(0);
  });

  test("cancelar en el modal de creación no crea ninguna plantilla", async ({ page }) => {
    const title = uniqueName("E2E Ficha Cancelada");

    await page.goto(ROUTE);
    await page.getByRole("button", { name: "Nueva plantilla" }).click();
    const dialog = page.getByRole("dialog", { name: "Nueva plantilla" });
    await dialog.getByLabel("Título").fill(title);
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();

    await page.getByLabel("Buscar").fill(title);
    await expect(page.getByRole("row", { name: title })).toHaveCount(0);
  });
});
