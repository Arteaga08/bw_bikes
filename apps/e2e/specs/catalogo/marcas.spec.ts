import { test, expect } from "../../fixtures/auth.js";
import { expectToast } from "../../helpers/toast.js";

const ROUTE = "/admin/catalogo/marcas";

/** Unique per call so parallel workers/runs never collide on the same name. */
function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

/**
 * `BrandsView` renders a card grid, not a `DataTable` — this is the one
 * screen among the four `FormModal` siblings that isn't table-based. Each
 * card is the exact wrapper `BrandsView.tsx`'s `renderCard` emits:
 * `<div className="flex flex-col overflow-hidden rounded-card-lg ...">`.
 */
function brandCard(page: import("@playwright/test").Page, name: string) {
  return page.locator("div.flex.flex-col.overflow-hidden.rounded-card-lg", { hasText: name });
}

test.describe("Catálogo · Marcas", () => {
  test("crea, edita y elimina una marca de principio a fin", async ({ page }) => {
    const originalName = uniqueName("E2E Marca");
    const editedName = uniqueName("E2E Marca Editada");

    await page.goto(ROUTE);

    // Crear
    await page.getByRole("button", { name: "Nueva marca" }).click();
    const createDialog = page.getByRole("dialog", { name: "Nueva marca" });
    await createDialog.getByLabel("Nombre").fill(originalName);
    await createDialog.getByRole("button", { name: "Guardar", exact: true }).click();
    await expectToast(page, "Marca creada");
    await expect(createDialog).toBeHidden();

    // La fila nueva aparece — se filtra por nombre para no depender de en qué
    // página de resultados cae entre corridas paralelas.
    await page.getByLabel("Buscar").fill(originalName);
    const card = brandCard(page, originalName);
    await expect(card.getByText(originalName, { exact: true })).toBeVisible();

    // Editar
    await card.getByRole("button", { name: "Editar" }).click();
    const editDialog = page.getByRole("dialog", { name: "Editar marca" });
    await editDialog.getByLabel("Nombre").fill(editedName);
    await editDialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expectToast(page, "Cambios guardados");
    await expect(editDialog).toBeHidden();

    await page.getByLabel("Buscar").fill(editedName);
    const editedCard = brandCard(page, editedName);
    await expect(editedCard.getByText(editedName, { exact: true })).toBeVisible();

    // Eliminar
    await editedCard.getByRole("button", { name: "Eliminar" }).click();
    const deleteDialog = page.getByRole("dialog", { name: "Eliminar marca" });
    await deleteDialog.getByRole("button", { name: "Sí, eliminar" }).click();
    await expectToast(page, "Marca eliminada");
    await expect(deleteDialog).toBeHidden();
    await expect(page.getByText(editedName, { exact: true })).toHaveCount(0);
  });

  test("cancelar en el modal de creación no crea ninguna marca", async ({ page }) => {
    const name = uniqueName("E2E Marca Cancelada");

    await page.goto(ROUTE);
    await page.getByRole("button", { name: "Nueva marca" }).click();
    const dialog = page.getByRole("dialog", { name: "Nueva marca" });
    await dialog.getByLabel("Nombre").fill(name);
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();

    await page.getByLabel("Buscar").fill(name);
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  });
});
