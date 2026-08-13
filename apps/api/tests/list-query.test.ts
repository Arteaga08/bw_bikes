import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { Bike } from "../src/models/index.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { createBikeCategoryDoc, seedBikes } from "./helpers/factories.js";

const ADMIN = "/api/v1/admin";
const PUBLIC = "/api/v1/catalog";

/**
 * The cross-cutting list utility (`parseListQuery` + `buildMeta`) every admin
 * list from here on reuses. Exercised through a real endpoint rather than as a
 * unit, because half of what makes it correct is the middleware chain around
 * it — Joi coercion of query strings, and the Express 5 query materialization
 * without which none of the sanitization applies (see utils/express-query.ts).
 */

describe("pagination meta", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    const category = await createBikeCategoryDoc({ slug: "ruta" });
    await seedBikes(25, category._id);
  });

  it("returns correct meta for a middle page", async () => {
    const response = await request(app).get(`${ADMIN}/bikes?page=2&limit=10`).set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({ total: 25, page: 2, pages: 3, limit: 10 });
    expect(response.body.data.bikes).toHaveLength(10);
  });

  it("returns the remainder on the last page", async () => {
    const response = await request(app).get(`${ADMIN}/bikes?page=3&limit=10`).set("Cookie", adminCookie);

    expect(response.body.meta).toEqual({ total: 25, page: 3, pages: 3, limit: 10 });
    expect(response.body.data.bikes).toHaveLength(5);
  });

  it("returns an empty page past the end, with meta still coherent", async () => {
    const response = await request(app).get(`${ADMIN}/bikes?page=9&limit=10`).set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.bikes).toHaveLength(0);
    expect(response.body.meta.pages).toBe(3);
    expect(response.body.meta.total).toBe(25);
  });

  it("reports pages: 1 on an empty collection instead of 0", async () => {
    await Bike.deleteMany({});

    const response = await request(app).get(`${ADMIN}/bikes`).set("Cookie", adminCookie);

    expect(response.body.meta).toEqual({ total: 0, page: 1, pages: 1, limit: 20 });
  });

  it("caps limit at 100 instead of honoring an unbounded request", async () => {
    const response = await request(app).get(`${ADMIN}/bikes?limit=5000`).set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.meta.limit).toBe(100);
  });

  it("rejects a non-positive page with 400", async () => {
    const response = await request(app).get(`${ADMIN}/bikes?page=0`).set("Cookie", adminCookie);

    expect(response.status).toBe(400);
  });
});

describe("sorting", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    const category = await createBikeCategoryDoc({ slug: "ruta" });
    await seedBikes(5, category._id);
  });

  it("sorts ascending and descending on a whitelisted field", async () => {
    const ascending = await request(app).get(`${ADMIN}/bikes?sort=price`).set("Cookie", adminCookie);
    const descending = await request(app).get(`${ADMIN}/bikes?sort=-price`).set("Cookie", adminCookie);

    const ascendingPrices = ascending.body.data.bikes.map((bike: { price: number }) => bike.price);
    const descendingPrices = descending.body.data.bikes.map((bike: { price: number }) => bike.price);

    expect(ascendingPrices).toEqual([...ascendingPrices].sort((a, b) => a - b));
    expect(descendingPrices).toEqual([...ascendingPrices].reverse());
  });

  it("rejects sorting by a field outside the whitelist", async () => {
    // An unvalidated sort key lets a caller order by — and therefore probe —
    // fields the projection is meant to hide.
    const response = await request(app).get(`${ADMIN}/bikes?sort=archivedAt`).set("Cookie", adminCookie);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("No se puede ordenar");
  });
});

describe("search is regex-escaped", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    const category = await createBikeCategoryDoc({ slug: "ruta" });
    await seedBikes(5, category._id);
  });

  it("treats regex metacharacters as literal text", async () => {
    const wildcard = await request(app).get(`${ADMIN}/bikes?search=.*`).set("Cookie", adminCookie);

    // Unescaped, `.*` would match every document. Escaped, it matches the
    // literal two-character string, which no bike name contains.
    expect(wildcard.status).toBe(200);
    expect(wildcard.body.data.bikes).toHaveLength(0);
    expect(wildcard.body.meta.total).toBe(0);
  });

  it("still finds a real match by name and by SKU", async () => {
    const byName = await request(app).get(`${ADMIN}/bikes?search=Bici%2003`).set("Cookie", adminCookie);
    expect(byName.body.data.bikes).toHaveLength(1);

    const bySku = await request(app).get(`${ADMIN}/bikes?search=BK-004`).set("Cookie", adminCookie);
    expect(bySku.body.data.bikes).toHaveLength(1);
  });

  it("does not hang on a catastrophic-backtracking pattern", async () => {
    const started = Date.now();
    const response = await request(app).get(`${ADMIN}/bikes?search=${encodeURIComponent("(a+)+$")}`).set(
      "Cookie",
      adminCookie,
    );

    expect(response.status).toBe(200);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe("filters are explicit, never a raw query object", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;
  let categoryId: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    const category = await createBikeCategoryDoc({ slug: "ruta" });
    categoryId = String(category._id);
    await seedBikes(6, category._id);
  });

  it("filters by brand and by price range", async () => {
    // `brand` travels as the brand's `slug`, case-insensitively — see
    // `seedBikes`, which gives the "Canyon" fixture the slug "canyon".
    const byBrand = await request(app).get(`${ADMIN}/bikes?brand=Canyon`).set("Cookie", adminCookie);
    expect(byBrand.body.data.bikes.every((bike: { brand: { name: string } }) => bike.brand.name === "Canyon")).toBe(
      true,
    );
    expect(byBrand.body.meta.total).toBe(3);

    // This one is where the Express 5 query fix (utils/express-query.ts) is
    // load-bearing: `minPrice` arrives as the string "1200000", and the
    // service only applies the range when it sees a number. Joi's coercion is
    // what converts it — and before the fix, that coercion was written to a
    // throwaway object and silently lost, so the filter never applied.
    const byPrice = await request(app)
      .get(`${ADMIN}/bikes?minPrice=1200000&maxPrice=1400000`)
      .set("Cookie", adminCookie);
    expect(byPrice.body.data.bikes.every((bike: { price: number }) => bike.price >= 1_200_000)).toBe(true);
    expect(byPrice.body.meta.total).toBeLessThan(6);
  });

  it("includes child categories when filtering by a parent category", async () => {
    const child = await createBikeCategoryDoc({ name: "Endurance", slug: "endurance" });
    await Bike.updateOne({ slug: "bici-00" }, { category: child._id }).exec();
    await Bike.updateOne({ _id: child._id }, {}).exec();
    // Re-parent the child under the root so the expansion has something to find.
    const { BikeCategory } = await import("../src/models/index.js");
    await BikeCategory.updateOne({ _id: child._id }, { parent: categoryId }).exec();

    const response = await request(app)
      .get(`${ADMIN}/bikes?category=${categoryId}`)
      .set("Cookie", adminCookie);

    // 5 directly in the root + 1 moved into its child.
    expect(response.body.meta.total).toBe(6);
  });

  it("ignores an unknown query parameter instead of forwarding it to Mongo", async () => {
    const response = await request(app)
      .get(`${ADMIN}/bikes?unknownField=whatever&price=1`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.meta.total).toBe(6);
  });

  it("strips a NoSQL operator injected through the query string", async () => {
    // Two layers stop this, and it's worth being precise about which. Express
    // 5's default "simple" query parser does not expand brackets into nested
    // objects, so this arrives as the flat key `brand[$ne]` rather than
    // `{brand: {$ne: ...}}`; `stripUnknown` then drops it for not being a
    // declared param. mongoSanitize is the backstop for the case where a
    // future `query parser` setting reintroduces nesting.
    const response = await request(app)
      .get(`${ADMIN}/bikes?brand[$ne]=Canyon`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.meta.total).toBe(6);
  });
});

describe("public lists", () => {
  it("never exposes archived or inactive products, whatever the query says", async () => {
    const app = buildApp();
    const category = await createBikeCategoryDoc({ slug: "ruta" });
    await seedBikes(3, category._id);
    await Bike.updateOne({ slug: "bici-00" }, { isActive: false, archivedAt: new Date() }).exec();

    // `isActive` isn't even a recognized param on the public schema — it's
    // stripped, and the service forces the visibility filter regardless.
    const response = await request(app).get(`${PUBLIC}/bikes?isActive=false`);

    expect(response.status).toBe(200);
    expect(response.body.meta.total).toBe(2);
    expect(response.body.data.bikes.every((bike: { slug: string }) => bike.slug !== "bici-00")).toBe(true);
  });
});
