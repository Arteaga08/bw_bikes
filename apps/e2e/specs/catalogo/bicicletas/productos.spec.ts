import { fileURLToPath } from "node:url";
import type { APIRequestContext } from "@playwright/test";
import { expect, test } from "../../../fixtures/auth.js";
import { expectToast } from "../../../helpers/toast.js";

/**
 * `/admin/catalogo/bicicletas` — the bikes catalog: list (`CatalogView.tsx`)
 * plus the 5-step create wizard (`ProductEditor.tsx`/`EditorStepper.tsx`).
 * Only the "alta completa" test walks the full stepper through the browser;
 * archive/restore/delete/filtros seed their own throwaway bike straight
 * through the admin API (same pattern `global-setup.ts` already uses) so
 * those tests aren't also re-proving the wizard every time.
 */

const TEST_IMAGE_PATH = fileURLToPath(new URL("../../../fixtures/test-image.png", import.meta.url));

const BRAND_NAME = "E2E Trek";
const CATEGORY_NAME = "E2E Bicicletas";
const SIZE_CHIP = "E2E-M";
const ADMIN_API_BASE = "/api/v1/admin";

function uniqueBikeName(): string {
  return `E2E Bici Playwright ${Date.now()}`;
}

async function findBrandId(request: APIRequestContext, name: string): Promise<string> {
  const res = await request.get(`${ADMIN_API_BASE}/brands?limit=100&sort=name`);
  const body = (await res.json()) as { data: { brands: { id: string; name: string }[] } };
  const brand = body.data.brands.find((candidate) => candidate.name === name);
  if (!brand) throw new Error(`[bicicletas.spec] Brand "${name}" not found — did global-setup seed it?`);
  return brand.id;
}

async function findBikeCategoryId(request: APIRequestContext, name: string): Promise<string> {
  const res = await request.get(`${ADMIN_API_BASE}/bike-categories/tree`);
  const body = (await res.json()) as { data: { tree: { id: string; name: string }[] } };
  const category = body.data.tree.find((candidate) => candidate.name === name);
  if (!category) throw new Error(`[bicicletas.spec] Category "${name}" not found — did seed-e2e-orders.ts run?`);
  return category.id;
}

/** Creates a throwaway bike straight through the admin API — mirrors `createBikeSchema`'s minimum required shape. */
async function createBikeViaApi(request: APIRequestContext, name: string): Promise<{ id: string }> {
  const [brandId, categoryId] = await Promise.all([
    findBrandId(request, BRAND_NAME),
    findBikeCategoryId(request, CATEGORY_NAME),
  ]);
  const res = await request.post(`${ADMIN_API_BASE}/bikes`, {
    data: {
      name,
      brand: brandId,
      category: categoryId,
      description: "Bicicleta de prueba generada por productos.spec.ts.",
      shortDescription: "Descripción corta de prueba e2e.",
      price: 100000,
    },
  });
  if (!res.ok()) throw new Error(`[bicicletas.spec] POST /bikes failed (${res.status()}): ${await res.text()}`);
  const body = (await res.json()) as { data: { bike: { id: string } } };
  return body.data.bike;
}

async function archiveBikeViaApi(request: APIRequestContext, id: string): Promise<void> {
  const res = await request.post(`${ADMIN_API_BASE}/bikes/${id}/archive`);
  if (!res.ok()) throw new Error(`[bicicletas.spec] POST /bikes/${id}/archive failed (${res.status()})`);
}

test.describe("Catálogo de bicicletas", () => {
  test("recorrido de alta completo: crea una bicicleta a través de los 5 pasos del stepper", async ({ page }) => {
    const name = uniqueBikeName();

    await page.goto("/admin/catalogo/bicicletas/nueva");
    await expect(page.getByRole("heading", { name: "Nueva bicicleta" })).toBeVisible();

    // Paso 1 — Datos generales.
    await page.getByLabel("Nombre").fill(name);
    await page.getByLabel("Marca").selectOption({ label: BRAND_NAME });
    const categoryField = page.getByRole("combobox", { name: "Categoría" });
    await categoryField.fill(CATEGORY_NAME);
    await page.getByRole("option", { name: CATEGORY_NAME, exact: true }).click();
    await page.getByLabel("Descripción", { exact: true }).fill("Descripción de prueba generada por e2e.");
    await page.getByLabel("Precio (MXN)").fill("1000.00");
    await page.getByLabel("Descripción corta").fill("Descripción corta de prueba e2e.");
    await page.getByRole("button", { name: "Siguiente" }).click();

    // Paso 2 — Tallas y variantes: el chip crea la fila; el SKU solo se
    // autocalcula (`buildSkuBase`) una vez que la fila tiene color, así que
    // hay que elegir uno de los colores sembrados (`E2E Negro`) para que el
    // SKU deje de estar vacío — un SKU vacío no pasa la validación del backend.
    await expect(page.getByRole("heading", { name: "Tallas y variantes" })).toBeVisible();
    await page.getByRole("button", { name: SIZE_CHIP }).click();
    await page.getByLabel("Color").selectOption({ label: "E2E Negro" });
    await expect(page.getByLabel("SKU")).not.toHaveValue("");
    await page.getByRole("button", { name: "Siguiente" }).click();

    // Paso 3 — Ficha técnica y resumen: nada obligatorio, se avanza directo.
    await expect(page.getByRole("heading", { name: "Ficha técnica" })).toBeVisible();
    await page.getByRole("button", { name: "Siguiente" }).click();

    // Paso 4 — Imágenes: `GallerySection` está code-splitted (`next/dynamic`, `ssr:false`).
    await expect(page.getByRole("heading", { name: "Galería" })).toBeVisible();
    await expect(page.getByText("Arrastra imágenes aquí o elige archivos")).toBeVisible();
    await page.getByLabel("Subir imágenes").setInputFiles(TEST_IMAGE_PATH);
    await expect(page.getByText("Portada")).toBeVisible();
    await page.getByRole("button", { name: "Siguiente" }).click();

    // Paso 5 — Revisar y guardar.
    await expect(page.getByRole("heading", { name: "Resumen antes de guardar" })).toBeVisible();
    await page.getByRole("button", { name: "Crear bicicleta" }).click();

    await expectToast(page, "Bicicleta creada");
    await expect(page).toHaveURL(/\/admin\/catalogo\/bicicletas\/[a-f0-9]{24}$/);
  });

  test("archivar y restaurar una bicicleta desde el listado", async ({ page, request }) => {
    const name = uniqueBikeName();
    await createBikeViaApi(request, name);

    await page.goto("/admin/catalogo/bicicletas");
    await page.getByLabel("Buscar").fill(name);
    await expect(page.getByText(name, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Archivar" }).click();
    await expect(page.getByRole("dialog", { name: "Archivar producto" })).toBeVisible();
    await page.getByRole("button", { name: "Sí, archivar" }).click();
    await expectToast(page, "Producto archivado");

    await expect(page.getByRole("button", { name: "Restaurar" })).toBeVisible();
    await page.getByRole("button", { name: "Restaurar" }).click();
    await expect(page.getByRole("dialog", { name: "Restaurar producto" })).toBeVisible();
    await page.getByRole("button", { name: "Sí, restaurar" }).click();
    await expectToast(page, "Producto restaurado");
  });

  test("eliminar una bicicleta archivada la quita del listado", async ({ page, request }) => {
    const name = uniqueBikeName();
    const bike = await createBikeViaApi(request, name);
    await archiveBikeViaApi(request, bike.id);

    await page.goto("/admin/catalogo/bicicletas");
    await page.getByLabel("Buscar").fill(name);
    await expect(page.getByText(name, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByRole("dialog", { name: "Eliminar bicicleta" })).toBeVisible();
    await page.getByRole("button", { name: "Sí, eliminar" }).click();
    await expectToast(page, "Bicicleta eliminada");

    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  });

  test("filtra el listado por nombre", async ({ page, request }) => {
    const name = uniqueBikeName();
    await createBikeViaApi(request, name);

    await page.goto("/admin/catalogo/bicicletas");
    await page.getByLabel("Buscar").fill(name);
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(1);

    await page.getByLabel("Buscar").fill(`nombre-que-no-existe-${Date.now()}`);
    await expect(page.getByText("No hay bicicletas con estos filtros")).toBeVisible();
  });
});
