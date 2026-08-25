import { fileURLToPath } from "node:url";
import type { APIRequestContext } from "@playwright/test";
import { expect, test } from "../../../fixtures/auth.js";
import { expectToast } from "../../../helpers/toast.js";

/**
 * `/admin/catalogo/accesorios` — same `CatalogView`/`ProductEditor` engine as
 * bicicletas (`ProductEditor.tsx`'s own doc comment: "one engine, two
 * independent catalogs"), minus the three bike-only fields (descripción
 * corta, geometría, accesorios sugeridos/resumen). See
 * `apps/e2e/specs/catalogo/bicicletas/productos.spec.ts` for the fuller
 * rationale behind seeding archive/restore/delete/filtros through the admin
 * API instead of re-walking the wizard for each of them.
 */

const TEST_IMAGE_PATH = fileURLToPath(new URL("../../../fixtures/test-image.png", import.meta.url));

const BRAND_NAME = "E2E Trek";
const CATEGORY_NAME = "E2E Accesorios";
const SIZE_CHIP = "E2E-U";
const ADMIN_API_BASE = "/api/v1/admin";

function uniqueAccessoryName(): string {
  return `E2E Accesorio Playwright ${Date.now()}`;
}

async function findBrandId(request: APIRequestContext, name: string): Promise<string> {
  const res = await request.get(`${ADMIN_API_BASE}/brands?limit=100&sort=name`);
  const body = (await res.json()) as { data: { brands: { id: string; name: string }[] } };
  const brand = body.data.brands.find((candidate) => candidate.name === name);
  if (!brand) throw new Error(`[accesorios.spec] Brand "${name}" not found — did global-setup seed it?`);
  return brand.id;
}

async function findAccessoryCategoryId(request: APIRequestContext, name: string): Promise<string> {
  const res = await request.get(`${ADMIN_API_BASE}/accessory-categories/tree`);
  const body = (await res.json()) as { data: { tree: { id: string; name: string }[] } };
  const category = body.data.tree.find((candidate) => candidate.name === name);
  if (!category) throw new Error(`[accesorios.spec] Category "${name}" not found — did seed-e2e-orders.ts run?`);
  return category.id;
}

/** Creates a throwaway accessory straight through the admin API — mirrors `createAccessorySchema`'s minimum required shape. */
async function createAccessoryViaApi(request: APIRequestContext, name: string): Promise<{ id: string }> {
  const [brandId, categoryId] = await Promise.all([
    findBrandId(request, BRAND_NAME),
    findAccessoryCategoryId(request, CATEGORY_NAME),
  ]);
  const res = await request.post(`${ADMIN_API_BASE}/accessories`, {
    data: {
      name,
      brand: brandId,
      category: categoryId,
      description: "Accesorio de prueba generado por productos.spec.ts.",
      price: 50000,
    },
  });
  if (!res.ok()) throw new Error(`[accesorios.spec] POST /accessories failed (${res.status()}): ${await res.text()}`);
  const body = (await res.json()) as { data: { accessory: { id: string } } };
  return body.data.accessory;
}

async function archiveAccessoryViaApi(request: APIRequestContext, id: string): Promise<void> {
  const res = await request.post(`${ADMIN_API_BASE}/accessories/${id}/archive`);
  if (!res.ok()) throw new Error(`[accesorios.spec] POST /accessories/${id}/archive failed (${res.status()})`);
}

test.describe("Catálogo de accesorios", () => {
  test("recorrido de alta completo: crea un accesorio a través de los 5 pasos del stepper", async ({ page }) => {
    const name = uniqueAccessoryName();

    await page.goto("/admin/catalogo/accesorios/nueva");
    await expect(page.getByRole("heading", { name: "Nuevo accesorio" })).toBeVisible();

    // Paso 1 — Datos generales (los accesorios no tienen descripción corta).
    await page.getByLabel("Nombre").fill(name);
    await page.getByLabel("Marca").selectOption({ label: BRAND_NAME });
    const categoryField = page.getByRole("combobox", { name: "Categoría" });
    await categoryField.fill(CATEGORY_NAME);
    await page.getByRole("option", { name: CATEGORY_NAME, exact: true }).click();
    await page.getByLabel("Descripción", { exact: true }).fill("Descripción de prueba generada por e2e.");
    await page.getByLabel("Precio (MXN)").fill("500.00");
    await page.getByRole("button", { name: "Siguiente" }).click();

    // Paso 2 — Tallas y variantes: mismo requisito de color que bicicletas
    // para que `buildSkuBase` deje de producir un SKU vacío.
    await expect(page.getByRole("heading", { name: "Tallas y variantes" })).toBeVisible();
    await page.getByRole("button", { name: SIZE_CHIP }).click();
    await page.getByLabel("Color").selectOption({ label: "E2E Negro" });
    await expect(page.getByLabel("SKU")).not.toHaveValue("");
    await page.getByRole("button", { name: "Siguiente" }).click();

    // Paso 3 — Ficha técnica (sin "Resumen" — ese bloque es solo de bicicletas).
    await expect(page.getByRole("heading", { name: "Ficha técnica" })).toBeVisible();
    await page.getByRole("button", { name: "Siguiente" }).click();

    // Paso 4 — Imágenes (sin geometría — solo la galería).
    await expect(page.getByRole("heading", { name: "Galería" })).toBeVisible();
    await expect(page.getByText("Arrastra imágenes aquí o elige archivos")).toBeVisible();
    await page.getByLabel("Subir imágenes").setInputFiles(TEST_IMAGE_PATH);
    await expect(page.getByText("Portada")).toBeVisible();
    await page.getByRole("button", { name: "Siguiente" }).click();

    // Paso 5 — Revisar y guardar (sin "Accesorios sugeridos" — solo bicicletas).
    await expect(page.getByRole("heading", { name: "Resumen antes de guardar" })).toBeVisible();
    await page.getByRole("button", { name: "Crear accesorio" }).click();

    await expectToast(page, "Accesorio creada");
    await expect(page).toHaveURL(/\/admin\/catalogo\/accesorios\/[a-f0-9]{24}$/);
  });

  test("archivar y restaurar un accesorio desde el listado", async ({ page, request }) => {
    const name = uniqueAccessoryName();
    await createAccessoryViaApi(request, name);

    await page.goto("/admin/catalogo/accesorios");
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

  test("eliminar un accesorio archivado lo quita del listado", async ({ page, request }) => {
    const name = uniqueAccessoryName();
    const accessory = await createAccessoryViaApi(request, name);
    await archiveAccessoryViaApi(request, accessory.id);

    await page.goto("/admin/catalogo/accesorios");
    await page.getByLabel("Buscar").fill(name);
    await expect(page.getByText(name, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByRole("dialog", { name: "Eliminar accesorio" })).toBeVisible();
    await page.getByRole("button", { name: "Sí, eliminar" }).click();
    await expectToast(page, "Accesorio eliminado");

    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  });

  test("filtra el listado por nombre", async ({ page, request }) => {
    const name = uniqueAccessoryName();
    await createAccessoryViaApi(request, name);

    await page.goto("/admin/catalogo/accesorios");
    await page.getByLabel("Buscar").fill(name);
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(1);

    await page.getByLabel("Buscar").fill(`nombre-que-no-existe-${Date.now()}`);
    await expect(page.getByText("No hay accesorios con estos filtros")).toBeVisible();
  });
});
