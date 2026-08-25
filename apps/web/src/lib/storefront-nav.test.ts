import { describe, expect, it } from "vitest";
import { isStorefrontNavItemActive, STOREFRONT_NAV_ITEMS } from "./storefront-nav";

describe("STOREFRONT_NAV_ITEMS", () => {
  it("lists the three navbar destinations from the Orbea-referenced redesign, in order", () => {
    expect(STOREFRONT_NAV_ITEMS.map((item) => item.label)).toEqual(["Bicicletas", "Accesorios", "Ofertas"]);
  });
});

describe("isStorefrontNavItemActive", () => {
  it("matches an item whose route equals the current path", () => {
    expect(isStorefrontNavItemActive("/accesorios", "/accesorios")).toBe(true);
  });

  it("matches a sub-route by prefix (e.g. a product page under the catalog)", () => {
    expect(isStorefrontNavItemActive("/bicicletas/trek-domane-sl6", "/bicicletas")).toBe(true);
  });

  it("ignores an item's own query string when comparing", () => {
    expect(isStorefrontNavItemActive("/bicicletas", "/bicicletas?categoria=electrica")).toBe(true);
  });

  it("does not match an unrelated path", () => {
    expect(isStorefrontNavItemActive("/accesorios", "/bicicletas")).toBe(false);
  });

  it("does not match a path that merely starts with the same letters", () => {
    expect(isStorefrontNavItemActive("/bicicletas-electricas", "/bicicletas")).toBe(false);
  });
});
