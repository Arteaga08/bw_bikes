import { describe, expect, it } from "vitest";
import { NAV_ITEMS_FLAT, NAV_SECTIONS } from "./nav";

describe("NAV_SECTIONS", () => {
  it("gives every section at least one item", () => {
    for (const section of NAV_SECTIONS) {
      expect(section.items.length).toBeGreaterThan(0);
    }
  });

  it("never repeats an href across sections", () => {
    const hrefs = NAV_ITEMS_FLAT.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("flattens to the thirteen real phase-2 destinations", () => {
    expect(NAV_ITEMS_FLAT).toHaveLength(13);
    expect(NAV_ITEMS_FLAT.map((item) => item.href)).toEqual([
      "/admin",
      "/admin/ordenes",
      "/admin/inventario",
      "/admin/solicitudes",
      "/admin/catalogo/marcas",
      "/admin/catalogo/badges",
      "/admin/catalogo/fichas-tecnicas",
      "/admin/catalogo/categorias/bicicletas",
      "/admin/catalogo/bicicletas",
      "/admin/catalogo/categorias/accesorios",
      "/admin/catalogo/accesorios",
      "/admin/analitica",
      "/admin/configuracion",
    ]);
  });
});
