import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { SpecTemplate } from "../src/models/index.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { createBikeCategoryDoc, createBrandDoc } from "./helpers/factories.js";

const ADMIN = "/api/v1/admin";

describe("spec template CRUD", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
  });

  it("runs the full create/read/update/delete cycle over the API", async () => {
    const created = await request(app)
      .post(`${ADMIN}/spec-templates`)
      .set("Cookie", adminCookie)
      .send({ title: "Geometría", fields: [{ label: "Talla", order: 0 }, { label: "Stack", order: 1 }] });

    expect(created.status).toBe(201);
    expect(created.body.data.template.source).toBe("manual");
    expect(created.body.data.template.fields).toHaveLength(2);
    const id = created.body.data.template.id as string;

    const read = await request(app).get(`${ADMIN}/spec-templates/${id}`).set("Cookie", adminCookie);
    expect(read.status).toBe(200);
    expect(read.body.data.template.title).toBe("Geometría");

    const updated = await request(app)
      .patch(`${ADMIN}/spec-templates/${id}`)
      .set("Cookie", adminCookie)
      .send({ fields: [{ label: "Talla", order: 0 }, { label: "Reach", order: 1 }] });
    expect(updated.status).toBe(200);
    expect(updated.body.data.template.fields.map((f: { label: string }) => f.label)).toEqual(["Talla", "Reach"]);

    const removed = await request(app).delete(`${ADMIN}/spec-templates/${id}`).set("Cookie", adminCookie);
    expect(removed.status).toBe(200);
    expect(await SpecTemplate.countDocuments()).toBe(0);
  });

  it("rejects a duplicate title (case-insensitive) with 409", async () => {
    await request(app).post(`${ADMIN}/spec-templates`).set("Cookie", adminCookie).send({ title: "Transmisión", fields: [] });

    const duplicate = await request(app)
      .post(`${ADMIN}/spec-templates`)
      .set("Cookie", adminCookie)
      .send({ title: "transmisión", fields: [] });

    expect(duplicate.status).toBe(409);
  });
});

describe("learning templates from a product's spec sheet", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;
  let bikeId: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    const [category, brand] = await Promise.all([createBikeCategoryDoc(), createBrandDoc()]);

    const created = await request(app).post(`${ADMIN}/bikes`).set("Cookie", adminCookie).send({
      name: "Tarmac SL8",
      brand: String(brand._id),
      category: String(category._id),
      shortDescription: "Bici de ruta",
      description: "Descripción",
      price: 19_999_900,
    });
    bikeId = created.body.data.bike.id as string;
  });

  function putGroups(groups: unknown) {
    return request(app).put(`${ADMIN}/bikes/${bikeId}/spec-groups`).set("Cookie", adminCookie).send({ groups });
  }

  it("creates an auto template the first time a group title is saved", async () => {
    const response = await putGroups([
      { title: "Geometría", order: 0, fields: [{ label: "Talla", value: "M", order: 0 }] },
    ]);
    expect(response.status).toBe(200);

    const templates = await SpecTemplate.find({ title: "Geometría" }).exec();
    expect(templates).toHaveLength(1);
    expect(templates[0]?.source).toBe("auto");
    expect(templates[0]?.fields.map((f) => f.label)).toEqual(["Talla"]);
  });

  it("merges new labels into the existing template instead of duplicating it", async () => {
    await putGroups([{ title: "Geometría", order: 0, fields: [{ label: "Talla", value: "M", order: 0 }] }]);

    await putGroups([
      {
        title: "Geometría",
        order: 0,
        fields: [
          { label: "Talla", value: "M", order: 0 },
          { label: "Stack", value: "580mm", order: 1 },
        ],
      },
    ]);

    const templates = await SpecTemplate.find({ title: "Geometría" }).exec();
    expect(templates).toHaveLength(1);
    expect(templates[0]?.fields.map((f) => f.label)).toEqual(["Talla", "Stack"]);
  });

  it("never downgrades a manual template to auto when a product reuses its title", async () => {
    await request(app)
      .post(`${ADMIN}/spec-templates`)
      .set("Cookie", adminCookie)
      .send({ title: "Sistema eléctrico", fields: [{ label: "Motor", order: 0 }] });

    await putGroups([
      { title: "Sistema eléctrico", order: 0, fields: [{ label: "Batería", value: "601Wh", order: 0 }] },
    ]);

    const templates = await SpecTemplate.find({ title: "Sistema eléctrico" }).exec();
    expect(templates).toHaveLength(1);
    expect(templates[0]?.source).toBe("manual");
    // The manually-curated label survives, and the new one merges in.
    expect(templates[0]?.fields.map((f) => f.label).sort()).toEqual(["Batería", "Motor"]);
  });

  it("a group with no title is never learned", async () => {
    const response = await putGroups([{ title: "  ", order: 0, fields: [] }]);
    // Rejected by the Joi schema itself (title is required, non-empty) —
    // confirms the empty-title guard in `learnSpecTemplates` is defensive,
    // not the only line of defense.
    expect(response.status).toBe(400);
    expect(await SpecTemplate.countDocuments()).toBe(0);
  });

  it("saving the spec sheet succeeds and is immediately reflected in the response", async () => {
    // `learnSpecTemplates` is awaited (same discipline as `recordAuditLog`),
    // so by the time this response lands, learning has already run and
    // couldn't have thrown back into it — its own try/catch guarantees that.
    const response = await putGroups([
      { title: "Cuadro", order: 0, fields: [{ label: "Material", value: "Carbono", order: 0 }] },
    ]);
    expect(response.status).toBe(200);
    expect(response.body.data.specGroups[0].title).toBe("Cuadro");
  });
});
