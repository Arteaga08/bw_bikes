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

  it("flattens to the eighteen real phase-2 destinations", () => {
    expect(NAV_ITEMS_FLAT).toHaveLength(18);
    expect(NAV_ITEMS_FLAT.map((item) => item.href)).toEqual([
      "/admin",
      "/admin/ordenes",
      "/admin/inventario",
      "/admin/solicitudes",
      "/admin/catalogo/marcas",
      "/admin/catalogo/badges",
      "/admin/catalogo/colores",
      "/admin/catalogo/fichas-tecnicas",
      "/admin/catalogo/categorias/bicicletas",
      "/admin/catalogo/tallas/bicicletas",
      "/admin/catalogo/bicicletas",
      "/admin/catalogo/categorias/accesorios",
      "/admin/catalogo/tallas/accesorios",
      "/admin/catalogo/accesorios",
      "/admin/contenido/inicio",
      "/admin/analitica",
      "/admin/configuracion",
      "/admin/auditoria",
    ]);
  });

  it("scopes Auditoría to superadmin — the one item not every admin role sees", () => {
    const audit = NAV_ITEMS_FLAT.find((item) => item.href === "/admin/auditoria");
    expect(audit?.roles).toEqual(["superadmin"]);
    expect(NAV_ITEMS_FLAT.filter((item) => item.href !== "/admin/auditoria").every((item) => item.roles === undefined)).toBe(
      true,
    );
  });
});
