import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "../fixtures/auth.js";
import { expectToast } from "../helpers/toast.js";

/**
 * `/admin/inventario` — `InventarioView.tsx`: alert cards, "Por categoría"
 * (`CategoryBand`/`InventoryRow`) and the search-by-SKU list, plus the two
 * dialogs (`StockAdjustDialog`, `NewInventoryEntryDialog`). Reuses the bike
 * `seed-e2e-orders.ts` already seeded (`E2E-TREK-DOMANE-M-RED`, 20 units on
 * hand) for the adjust test, and creates its own throwaway bike variant with
 * no inventory row yet for the "Registrar entrada" test — that dialog only
 * offers variants that don't already have a stock row (`NewInventoryEntryDialog`'s
 * own doc comment), so reusing an already-stocked seeded SKU there wouldn't work.
 */

const ADMIN_API_BASE = "/api/v1/admin";
const BRAND_NAME = "E2E Trek";
const BIKE_CATEGORY_NAME = "E2E Bicicletas";
const SEEDED_BIKE_SKU_IN_STOCK = "E2E-TREK-DOMANE-M-RED";
const SEEDED_ACCESSORY_SKU_IN_STOCK = "E2E-TREK-VERVE-U-BLK";

async function findBrandId(request: APIRequestContext, name: string): Promise<string> {
  const res = await request.get(`${ADMIN_API_BASE}/brands?limit=100&sort=name`);
  const body = (await res.json()) as { data: { brands: { id: string; name: string }[] } };
  const brand = body.data.brands.find((candidate) => candidate.name === name);
  if (!brand) throw new Error(`[inventario.spec] Brand "${name}" not found — did global-setup seed it?`);
  return brand.id;
}

async function findBikeCategoryId(request: APIRequestContext, name: string): Promise<string> {
  const res = await request.get(`${ADMIN_API_BASE}/bike-categories/tree`);
  const body = (await res.json()) as { data: { tree: { id: string; name: string }[] } };
  const category = body.data.tree.find((candidate) => candidate.name === name);
  if (!category) throw new Error(`[inventario.spec] Category "${name}" not found — did seed-e2e-orders.ts run?`);
  return category.id;
}

/** A throwaway bike with exactly one `in_stock` variant carrying no `initialStock` — so it has no `InventoryItem` row yet, the precondition `NewInventoryEntryDialog` needs to offer it. */
async function createBikeWithUnstockedVariant(request: APIRequestContext): Promise<{ id: string; name: string; sku: string }> {
  const [brandId, categoryId] = await Promise.all([
    findBrandId(request, BRAND_NAME),
    findBikeCategoryId(request, BIKE_CATEGORY_NAME),
  ]);
  const name = `E2E Bici Inventario ${Date.now()}`;
  const sku = `E2E-INV-${Date.now()}`;
  const res = await request.post(`${ADMIN_API_BASE}/bikes`, {
    data: {
      name,
      brand: brandId,
      category: categoryId,
      description: "Bicicleta de prueba para inventario.spec.ts.",
      shortDescription: "Descripción corta de prueba e2e.",
      price: 100000,
      variants: [{ sku, size: "U", color: "Negro", fulfillmentMode: "in_stock" }],
    },
  });
  if (!res.ok()) throw new Error(`[inventario.spec] POST /bikes failed (${res.status()}): ${await res.text()}`);
  const body = (await res.json()) as { data: { bike: { id: string } } };
  return { id: body.data.bike.id, name, sku };
}

async function searchBySku(page: Page, sku: string): Promise<void> {
  await page.getByLabel("Buscar").fill(sku);
  await expect(page.getByText(sku)).toBeVisible();
}

test.describe("Inventario", () => {
  test("ajustar el stock de un SKU con inventario existente", async ({ page }) => {
    await page.goto("/admin/inventario");
    await searchBySku(page, SEEDED_BIKE_SKU_IN_STOCK);

    await page.getByRole("button", { name: "Ajustar" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByLabel("Unidades").fill("3");
    await page.getByLabel("Motivo").fill("Ajuste automatizado — productos.spec.ts.");
    await page.getByRole("button", { name: "Guardar" }).click();

    await expectToast(page, "Stock actualizado");
  });

  test("registrar una nueva entrada de inventario", async ({ page, request }) => {
    const bike = await createBikeWithUnstockedVariant(request);

    await page.goto("/admin/inventario");
    await page.getByRole("button", { name: "Registrar entrada" }).click();
    const dialog = page.getByRole("dialog", { name: "Registrar entrada" });
    await expect(dialog).toBeVisible();

    // "Tipo de producto" ya inicia en "Bicicleta". `getByLabel(..., { exact: true })`
    // for "Producto" — plain substring matching would also catch "Tipo de producto"'s
    // own `<select>`, which maps to the same `combobox` role.
    await page.getByLabel("Producto", { exact: true }).fill(bike.name);
    await page.getByRole("option", { name: bike.name, exact: true }).click();
    await page.getByLabel("Variante").selectOption({ value: bike.sku });
    await page.getByLabel("Stock inicial").fill("10");
    await dialog.getByRole("button", { name: "Registrar", exact: true }).click();

    await expectToast(page, "Entrada registrada");
  });

  test("las tarjetas de alerta se renderizan sin errores de consola", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    await page.goto("/admin/inventario");

    await expect(page.getByText("Agotados", { exact: true })).toBeVisible();
    await expect(page.getByText("Bajos", { exact: true })).toBeVisible();
    await expect(page.getByText("Nuevos", { exact: true })).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test("filtra el listado por SKU", async ({ page }) => {
    await page.goto("/admin/inventario");
    await page.getByRole("tab", { name: "Accesorios" }).click();
    await searchBySku(page, SEEDED_ACCESSORY_SKU_IN_STOCK);
    await expect(page.getByRole("button", { name: "Ajustar" })).toHaveCount(1);

    await page.getByLabel("Buscar").fill(`sku-que-no-existe-${Date.now()}`);
    await expect(page.getByText("Sin resultados")).toBeVisible();
  });
});
