import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../fixtures/auth.js";
import { expectToast } from "../helpers/toast.js";

/**
 * Highest-risk spec in the suite: Órdenes moves real (test-mode) Stripe
 * money on "Confirmar"/"Rechazar". `test.describe.serial` is deliberate —
 * every test here shares the same 13 orders `seed-e2e-orders.ts` seeded
 * (`apps/api/src/scripts/seed-e2e-orders.ts`), and several tests (bulk,
 * shipment) depend on a status bucket another test in this file just grew
 * or shrank. Running them one at a time, in this exact order, is what makes
 * "take the first row of tab X" deterministic instead of a race against a
 * sibling test in another worker.
 *
 * Post-redesign: "Todas" is the default tab (not "Cola de proveedor"), the
 * detail panel is a right-hand `SlideOver` opened by clicking a row's own
 * folio button (there is no more "Ver detalle" button), and
 * Confirmar/Rechazar render inline on any row whose *order* is
 * `awaiting_supplier_confirmation`, regardless of which tab is showing it.
 *
 * Labels/toasts below are read verbatim from source, not guessed:
 *  - `apps/web/src/lib/orders/status.ts` (ORDER_STATUS_LABELS, DISPUTE_STATUS_LABELS)
 *  - `apps/web/src/app/admin/(panel)/ordenes/OrdersView.tsx` (every toast title)
 *  - `ConfirmSupplierDialog.tsx` / `RejectSupplierDialog.tsx` (dialog button text)
 */
test.describe.serial("Órdenes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/ordenes");
  });

  /** First `<tbody> <tr>` — desktop table only renders at Playwright's default (desktop-width) viewport. */
  function firstRow(page: Page): Locator {
    return page.locator("table tbody tr").first();
  }

  /** A row's folio — `OrderNumberCell` renders it as a `<button>` whose accessible name *is* the order number, and clicking it opens the detail panel (the redesign's replacement for the old "Ver detalle" button). */
  function orderButton(row: Locator): Locator {
    return row.getByRole("button", { name: /^BW-/ });
  }

  async function rowOrderNumber(row: Locator): Promise<string> {
    return (await orderButton(row).innerText()).trim();
  }

  async function switchToTodasTab(page: Page): Promise<void> {
    await page.getByRole("tab", { name: "Todas" }).click();
  }

  async function switchToQueueTab(page: Page): Promise<void> {
    await page.getByRole("tab", { name: /Cola de proveedor/ }).click();
  }

  async function filterByStatus(page: Page, label: string): Promise<void> {
    await page.getByLabel("Estatus").selectOption({ label });
  }

  async function filterByOrderNumber(page: Page, orderNumber: string): Promise<void> {
    await page.getByLabel("Número de orden").fill(orderNumber);
  }

  test("filtra por tabs/estatus: 'Todas' abre por defecto, cada filtro muestra solo su propio estatus, y la cola agrupa solo awaiting_supplier_confirmation", async ({
    page,
  }) => {
    // Default tab: "Todas" — the whole point of the redesign is landing on
    // the full operation, not the exception queue.
    await expect(page.getByRole("tab", { name: "Todas" })).toHaveAttribute("aria-selected", "true");

    const seededStatusLabels: Record<string, string> = {
      "pendiente de pago": "pending_payment",
      "esperando confirmación del proveedor": "awaiting_supplier_confirmation",
      "con autorización vencida": "authorization_expired",
      cancelada: "cancelled",
      pagada: "paid",
      "en preparación": "processing",
      enviada: "shipped",
      entregada: "delivered",
      reembolsada: "refunded",
    };

    for (const label of Object.keys(seededStatusLabels)) {
      await filterByStatus(page, label);
      const rows = page.locator("table tbody tr");
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        await expect(rows.nth(i).getByText(label, { exact: true })).toBeVisible();
      }
    }

    // Not seeded — must show the "no results" empty state, not stray rows.
    await filterByStatus(page, "autorizada");
    await expect(page.getByText("No hay órdenes con estos filtros")).toBeVisible();

    // The queue tab pins `status=awaiting_supplier_confirmation` — every row
    // in it shows Confirmar/Rechazar inline, the same `OrderRowActions` any
    // "Todas" row with that status renders (there's no separate "queue
    // columns" set anymore).
    await switchToQueueTab(page);
    await expect(page.getByRole("tab", { name: /Cola de proveedor/ })).toHaveAttribute("aria-selected", "true");
    const queueRows = page.locator("table tbody tr");
    const queueCount = await queueRows.count();
    expect(queueCount).toBeGreaterThan(0);
    for (let i = 0; i < queueCount; i++) {
      await expect(queueRows.nth(i).getByRole("button", { name: "Confirmar" })).toBeVisible();
      await expect(queueRows.nth(i).getByRole("button", { name: "Rechazar" })).toBeVisible();
    }
  });

  test("abrir una orden desde su folio abre el panel con líneas, dirección y bitácora, y cierra con Escape", async ({
    page,
  }) => {
    await filterByStatus(page, "cancelada");

    const row = firstRow(page);
    const orderNumber = await rowOrderNumber(row);
    await orderButton(row).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleName(orderNumber);
    await expect(dialog.getByText("Líneas", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Dirección de envío", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Bitácora", { exact: true })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("badge de disputa: la orden pagada con disputeStatus 'lost' muestra 'perdido' en el detalle", async ({ page }) => {
    // Runs before the confirm/reject tests below, while "pagada" is still
    // exactly the 2 orders seed-e2e-orders.ts left in that bucket (the
    // disputed bike + the plain accessory) — precise enough to check both.
    await filterByStatus(page, "pagada");
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();
    expect(count).toBe(2);

    let foundDisputed = false;
    for (let i = 0; i < count; i++) {
      await orderButton(rows.nth(i)).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      if (await dialog.getByText("perdido", { exact: true }).isVisible()) {
        foundDisputed = true;
        await expect(dialog.getByText("pagada", { exact: true }).first()).toBeVisible();
      }
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
    }
    expect(foundDisputed).toBe(true);
  });

  test("confirmar proveedor: clic real contra Stripe test-mode captura el cargo y la orden pasa a pagada", async ({
    page,
  }) => {
    await switchToQueueTab(page);
    const row = firstRow(page);
    await expect(row.getByRole("button", { name: "Confirmar" })).toBeVisible();
    const orderNumber = await rowOrderNumber(row);

    await row.getByRole("button", { name: "Confirmar" }).click();
    const dialog = page.getByRole("dialog", { name: `Confirmar ${orderNumber}` });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Confirmar y capturar el cargo" }).click();

    await expectToast(page, `${orderNumber} confirmada`);

    await switchToTodasTab(page);
    await filterByOrderNumber(page, orderNumber);
    await expect(page.getByText("pagada", { exact: true }).first()).toBeVisible();
  });

  test("rechazar proveedor: clic real contra Stripe test-mode cancela la autorización y la orden pasa a cancelada", async ({
    page,
  }) => {
    // Only one order is left in the queue — the previous test consumed the other.
    await switchToQueueTab(page);
    const rows = page.locator("table tbody tr");
    await expect(rows.first().getByRole("button", { name: "Rechazar" })).toBeVisible();
    await expect(rows).toHaveCount(1);

    const row = firstRow(page);
    const orderNumber = await rowOrderNumber(row);

    await row.getByRole("button", { name: "Rechazar" }).click();
    const dialog = page.getByRole("dialog", { name: `Rechazar ${orderNumber}` });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Motivo del rechazo").fill("Sin stock disponible con el proveedor.");
    await dialog.getByRole("button", { name: "Rechazar y liberar stock" }).click();

    await expectToast(page, `${orderNumber} rechazada`);

    await switchToTodasTab(page);
    await filterByOrderNumber(page, orderNumber);
    await expect(page.getByText("cancelada", { exact: true }).first()).toBeVisible();
  });

  test("cambia el estatus de una orden pagada a 'en preparación' desde el detalle", async ({ page }) => {
    await filterByStatus(page, "pagada");
    const row = firstRow(page);
    await expect(orderButton(row)).toBeVisible();
    await orderButton(row).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Marcar en preparación" }).click();

    await expectToast(page, "Estatus actualizado");
    await expect(dialog.getByText("en preparación", { exact: true }).first()).toBeVisible();
  });

  test("acción masiva: selecciona 2 órdenes pagadas y las marca 'en preparación'", async ({ page }) => {
    await filterByStatus(page, "pagada");
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(2);

    await rows.nth(0).getByRole("checkbox").check();
    await rows.nth(1).getByRole("checkbox").check();

    // `BulkStatusBar.tsx` interpolates as `orden` + `es` (no accent) — matches its literal source text.
    await expect(page.getByText("2 ordenes seleccionadas")).toBeVisible();
    await page.getByRole("button", { name: "Marcar en preparación" }).click();

    await expectToast(page, "Actualización masiva procesada");
  });

  test("captura la guía de envío de una orden en preparación y la marca como enviada", async ({ page }) => {
    await filterByStatus(page, "en preparación");
    const row = firstRow(page);
    await expect(orderButton(row)).toBeVisible();
    await orderButton(row).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Capturar guía" }).click();
    await dialog.getByLabel("Número de guía").fill("E2E-TRACK-0001");
    await dialog.getByRole("button", { name: "Capturar guía y marcar como enviada" }).click();

    await expectToast(page, "Guía capturada");
    await expect(dialog.getByText("enviada", { exact: true }).first()).toBeVisible();
  });

  test("edita la dirección de envío de una orden pendiente de pago", async ({ page }) => {
    await filterByStatus(page, "pendiente de pago");
    const row = firstRow(page);
    await expect(orderButton(row)).toBeVisible();
    await orderButton(row).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Editar" }).click();
    await dialog.getByLabel("Calle").fill("Av. Reforma 500");
    await dialog.getByRole("button", { name: "Guardar dirección" }).click();

    await expectToast(page, "Dirección actualizada");
  });

  test("agrega una nota interna a una orden pendiente de pago", async ({ page }) => {
    await filterByStatus(page, "pendiente de pago");
    // The other pending_payment order — the address test above already used
    // the first row, so this one hasn't been touched by any prior test.
    const rows = page.locator("table tbody tr");
    await expect(orderButton(rows.first())).toBeVisible();
    await expect(rows).toHaveCount(2);
    await orderButton(rows.nth(1)).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const noteBody = "Nota de prueba e2e — cliente sin incidencias.";
    await dialog.getByLabel("Agregar nota interna").fill(noteBody);
    await dialog.getByRole("button", { name: "Agregar nota" }).click();

    await expectToast(page, "Nota agregada");
    await expect(dialog.getByText(noteBody)).toBeVisible();
  });
});
