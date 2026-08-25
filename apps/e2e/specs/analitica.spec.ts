import { expect, test } from "../fixtures/auth.js";

/**
 * `/admin/analitica` — read from `apps/web/src/app/admin/(panel)/analitica/AnaliticaView.tsx`
 * before writing this: one `GET /admin/stats/overview` call feeds four
 * `StatCard`s, four `ChartCard`-wrapped `RankedBarChart`s, and an "Órdenes
 * por estatus" table. Asserts on `ChartCard` section headings (real text),
 * never on the SVG bars themselves.
 */
test.describe("Analítica", () => {
  test("carga sin errores de consola y renderiza al menos una sección", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/admin/analitica");

    await expect(page.getByText("Modelos más vistos", { exact: true })).toBeVisible();
    await expect(page.getByText("Modelos más vendidos", { exact: true })).toBeVisible();
    await expect(page.getByText("Tallas más vistas", { exact: true })).toBeVisible();
    await expect(page.getByText("Tallas más vendidas", { exact: true })).toBeVisible();
    await expect(page.getByText("Órdenes por estatus", { exact: true })).toBeVisible();

    await expect(page.getByText("No se pudo cargar la analítica.")).not.toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("cambiar el rango de fechas no produce error", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/admin/analitica");
    await expect(page.getByText("Órdenes por estatus", { exact: true })).toBeVisible();

    // `StatsRangePicker` (apps/web/src/components/ui/StatsRangePicker.tsx)
    // renders its presets as `Tab`s labeled "Día"/"Semana"/"Mes"/"Año"/"Personalizado".
    await page.getByRole("tab", { name: "Semana" }).click();
    await expect(page.getByRole("tab", { name: "Semana" })).toHaveAttribute("aria-selected", "true");

    await expect(page.getByText("No se pudo cargar la analítica.")).not.toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
