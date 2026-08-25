import { test, expect } from "../../../fixtures/auth.js";
import { expectToast } from "../../../helpers/toast.js";

const ROUTE = "/admin/catalogo/categorias/accesorios";

/** Unique per call so parallel workers/runs never collide on the same name. */
function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

test.describe("Catálogo · Categorías de accesorios (árbol)", () => {
  test("crea una raíz y una subcategoría, edita y elimina ambas", async ({ page }) => {
    const rootName = uniqueName("E2E Categoría Raíz Acc");
    const childName = uniqueName("E2E Subcategoría Acc");
    const editedChildName = uniqueName("E2E Subcategoría Acc Editada");

    await page.goto(ROUTE);

    // Crear la raíz — `CategoriesView` no pagina (trae el árbol completo en
    // un solo request), así que no hace falta filtrar por búsqueda aquí.
    await page.getByRole("button", { name: "Agregar categoría" }).click();
    const createRootDialog = page.getByRole("dialog", { name: "Nueva categoría" });
    await createRootDialog.getByLabel("Nombre").fill(rootName);
    await createRootDialog.getByRole("button", { name: "Guardar", exact: true }).click();
    await expectToast(page, "Categoría creada");
    await expect(createRootDialog).toBeHidden();

    const rootRow = page.getByRole("row", { name: rootName });
    await expect(rootRow).toBeVisible();

    // Crear la subcategoría desde la acción "Agregar subcategoría" de la raíz
    // — el modal debe abrir con "Categoría padre" ya preseleccionado a la raíz.
    await rootRow.getByRole("button", { name: "Agregar subcategoría" }).click();
    const createChildDialog = page.getByRole("dialog", { name: "Nueva categoría" });
    await expect(createChildDialog.getByLabel("Categoría padre").locator("option:checked")).toHaveText(rootName);
    await createChildDialog.getByLabel("Nombre").fill(childName);
    await createChildDialog.getByRole("button", { name: "Guardar", exact: true }).click();
    await expectToast(page, "Categoría creada");
    await expect(createChildDialog).toBeHidden();

    // El árbol muestra la subcategoría anidada bajo su padre: aparece
    // inmediatamente después de la raíz en el orden del documento, y su
    // celda de nombre lleva el indentado de `depth === 1` (`border-l`).
    const childRow = page.getByRole("row", { name: childName });
    await expect(childRow).toBeVisible();
    const rowNames = await page.getByRole("row").allTextContents();
    const rootIndex = rowNames.findIndex((text) => text.includes(rootName));
    const childIndex = rowNames.findIndex((text) => text.includes(childName));
    expect(childIndex).toBe(rootIndex + 1);
    await expect(childRow.locator("td").first().locator("div").first()).toHaveClass(/border-l/);

    // Editar la subcategoría
    await childRow.getByRole("button", { name: "Editar" }).click();
    const editChildDialog = page.getByRole("dialog", { name: "Editar categoría" });
    await editChildDialog.getByLabel("Nombre").fill(editedChildName);
    await editChildDialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expectToast(page, "Cambios guardados");
    await expect(editChildDialog).toBeHidden();

    const editedChildRow = page.getByRole("row", { name: editedChildName });
    await expect(editedChildRow).toBeVisible();

    // Eliminar la subcategoría — el botón de confirmación de esta vista dice
    // "Eliminar" a secas, no "Sí, eliminar" (inconsistencia real del código,
    // ver `CategoriesView.tsx`).
    await editedChildRow.getByRole("button", { name: "Eliminar" }).click();
    const deleteChildDialog = page.getByRole("dialog", { name: "Eliminar categoría" });
    await deleteChildDialog.getByRole("button", { name: "Eliminar", exact: true }).click();
    await expectToast(page, "Categoría eliminada");
    await expect(deleteChildDialog).toBeHidden();
    await expect(page.getByRole("row", { name: editedChildName })).toHaveCount(0);

    // Eliminar la raíz
    await rootRow.getByRole("button", { name: "Eliminar" }).click();
    const deleteRootDialog = page.getByRole("dialog", { name: "Eliminar categoría" });
    await deleteRootDialog.getByRole("button", { name: "Eliminar", exact: true }).click();
    await expectToast(page, "Categoría eliminada");
    await expect(deleteRootDialog).toBeHidden();
    await expect(page.getByRole("row", { name: rootName })).toHaveCount(0);
  });

  test("cancelar en el modal de creación no crea ninguna categoría", async ({ page }) => {
    const name = uniqueName("E2E Categoría Acc Cancelada");

    await page.goto(ROUTE);
    await page.getByRole("button", { name: "Agregar categoría" }).click();
    const dialog = page.getByRole("dialog", { name: "Nueva categoría" });
    await dialog.getByLabel("Nombre").fill(name);
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByRole("row", { name: name })).toHaveCount(0);
  });
});
