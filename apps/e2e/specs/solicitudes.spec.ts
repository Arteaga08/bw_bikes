import { expect, test } from "../fixtures/auth.js";
import { expectToast } from "../helpers/toast.js";

/**
 * `/admin/solicitudes` — `SolicitudesView.tsx`: the ambassador/sponsorship
 * approval bandeja (`Application` model, `apps/api/src/models/application.model.ts`).
 * `global-setup.ts` never seeds any `Application` document, and there's no
 * admin-side "create" action for one — a real applicant submits through
 * `POST /api/v1/applications/ambassador|sponsorship` (`protect`-only, no role
 * restriction: any authenticated user, including this suite's own superadmin
 * session, can submit one on their own account). Tests that need a pending
 * row submit one that way first, exactly as a real customer would, instead
 * of writing to Mongo directly.
 *
 * Ambassador and sponsorship (never the same type twice) are used across the
 * two data-driven tests below so they can run in parallel without racing the
 * one-pending-per-type unique index (`application.model.ts`'s partial index
 * on `{ userId, type }` where `status: "pending"`).
 */

function ambassadorPayload(): Record<string, string> {
  return {
    discipline: "Ruta",
    city: "Ciudad de México",
    socialMediaHandle: "@e2e_test",
    followersApprox: "1000",
    motivation: "Motivo de prueba generado automáticamente por solicitudes.spec.ts, con más de diez caracteres.",
  };
}

function sponsorshipPayload(): Record<string, string> {
  return {
    eventName: `Evento E2E ${Date.now()}`,
    eventDate: "2026-12-01",
    venue: "Foro de pruebas E2E",
    expectedAttendees: "100",
    supportRequested: "Apoyo de prueba generado automáticamente por solicitudes.spec.ts, con más de diez caracteres.",
  };
}

test.describe("Solicitudes", () => {
  test("la pantalla carga sin errores y la lista de solicitudes renderiza", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    await page.goto("/admin/solicitudes");

    await expect(page.getByRole("heading", { name: "Solicitudes" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Pendientes/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Aprobadas" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Rechazadas" })).toBeVisible();

    // Either the table has rows or the empty state explains there aren't
    // any — either way it's not the load-error state.
    const loaded = page.getByRole("table").or(page.getByText("No hay solicitudes pendientes"));
    await expect(loaded.first()).toBeVisible();
    await expect(page.getByText("No se pudieron cargar las solicitudes")).toHaveCount(0);

    expect(consoleErrors).toEqual([]);
  });

  test("aprobar una solicitud de embajador, viendo su detalle antes", async ({ page, request }) => {
    const submitted = await request.post("/api/v1/applications/ambassador", { multipart: ambassadorPayload() });
    expect(submitted.ok()).toBe(true);

    await page.goto("/admin/solicitudes");
    await page.getByLabel("Tipo").selectOption({ label: "Embajador" });

    await expect(page.getByRole("button", { name: "Ver detalle" })).toHaveCount(1);
    await page.getByRole("button", { name: "Ver detalle" }).click();

    const detail = page.getByRole("dialog");
    await expect(detail.getByText("Pendiente")).toBeVisible();
    await expect(detail.getByText("Ruta")).toBeVisible();

    // Cierra y vuelve a abrir para probar el cierre con "Cerrar panel" antes de aprobar.
    await page.getByRole("button", { name: "Cerrar panel" }).click();
    await expect(detail).toBeHidden();
    await page.getByRole("button", { name: "Ver detalle" }).click();
    await expect(detail).toBeVisible();

    await detail.getByRole("button", { name: "Aprobar" }).click();
    await expectToast(page, "Solicitud aprobada");
  });

  test("rechazar una solicitud de patrocinio con motivo", async ({ page, request }) => {
    const submitted = await request.post("/api/v1/applications/sponsorship", { multipart: sponsorshipPayload() });
    expect(submitted.ok()).toBe(true);

    await page.goto("/admin/solicitudes");
    await page.getByLabel("Tipo").selectOption({ label: "Patrocinio de evento" });

    await expect(page.getByRole("button", { name: "Ver detalle" })).toHaveCount(1);
    await page.getByRole("button", { name: "Ver detalle" }).click();

    const detail = page.getByRole("dialog");
    await expect(detail.getByText("Pendiente")).toBeVisible();
    await detail.getByRole("button", { name: "Rechazar" }).click();

    const rejectDialog = page.getByRole("dialog", { name: "Rechazar solicitud" });
    await expect(rejectDialog).toBeVisible();
    await rejectDialog.getByRole("textbox").fill("Motivo de rechazo generado por la suite e2e.");
    await rejectDialog.getByRole("button", { name: "Sí, rechazar" }).click();

    await expectToast(page, "Solicitud rechazada");
  });
});
