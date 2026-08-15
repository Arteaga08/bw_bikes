import { Types } from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { Bike, MAX_SPEC_GROUPS } from "../src/models/index.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { createBikeCategoryDoc, createBrandDoc } from "./helpers/factories.js";

const ADMIN = "/api/v1/admin";

/**
 * The free-form technical sheet (design spec §"Ficha técnica libre"). The
 * milestone's closing criterion is that all four editing actions work — add,
 * rename, reorder and delete — for groups *and* for fields. Each is exercised
 * below as a separate write, re-reading the document from the API afterwards
 * rather than trusting the write's own echo.
 */

const INITIAL_GROUPS = [
  {
    title: "Transmisión",
    order: 0,
    fields: [
      { label: "Grupo", value: "Shimano Dura-Ace Di2", order: 0 },
      { label: "Velocidades", value: "12", order: 1 },
    ],
  },
  {
    title: "Cuadro",
    order: 1,
    fields: [{ label: "Material", value: "Carbono FACT 10r", order: 0 }],
  },
];

describe("free-form spec sheet", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;
  let bikeId: string;

  async function readSpecGroups() {
    const response = await request(app).get(`${ADMIN}/bikes/${bikeId}`).set("Cookie", adminCookie);
    return response.body.data.bike.specGroups as typeof INITIAL_GROUPS;
  }

  function putGroups(groups: unknown) {
    return request(app)
      .put(`${ADMIN}/bikes/${bikeId}/spec-groups`)
      .set("Cookie", adminCookie)
      .send({ groups });
  }

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    const category = await createBikeCategoryDoc({ slug: "ruta" });
    const brand = await createBrandDoc();

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

  it("adds groups and fields to an empty sheet", async () => {
    const response = await putGroups(INITIAL_GROUPS);

    expect(response.status).toBe(200);
    const groups = await readSpecGroups();
    expect(groups).toHaveLength(2);
    expect(groups[0]?.title).toBe("Transmisión");
    expect(groups[0]?.fields).toHaveLength(2);
    expect(groups[1]?.fields[0]?.value).toBe("Carbono FACT 10r");
  });

  it("renames a group and a field", async () => {
    await putGroups(INITIAL_GROUPS);

    const renamed = structuredClone(INITIAL_GROUPS);
    renamed[0]!.title = "Grupo y transmisión";
    renamed[0]!.fields[0]!.label = "Grupo completo";

    const response = await putGroups(renamed);
    expect(response.status).toBe(200);

    const groups = await readSpecGroups();
    expect(groups[0]?.title).toBe("Grupo y transmisión");
    expect(groups[0]?.fields[0]?.label).toBe("Grupo completo");
    // Renaming must not disturb anything else.
    expect(groups[0]?.fields[0]?.value).toBe("Shimano Dura-Ace Di2");
    expect(groups).toHaveLength(2);
  });

  it("reorders groups and fields", async () => {
    await putGroups(INITIAL_GROUPS);

    const reordered = [
      { ...structuredClone(INITIAL_GROUPS[1]!), order: 0 },
      {
        ...structuredClone(INITIAL_GROUPS[0]!),
        order: 1,
        fields: [
          { label: "Velocidades", value: "12", order: 0 },
          { label: "Grupo", value: "Shimano Dura-Ace Di2", order: 1 },
        ],
      },
    ];

    const response = await putGroups(reordered);
    expect(response.status).toBe(200);

    const groups = await readSpecGroups();
    expect(groups.map((group) => group.title)).toEqual(["Cuadro", "Transmisión"]);
    expect(groups[1]?.fields.map((field) => field.label)).toEqual(["Velocidades", "Grupo"]);
  });

  it("deletes a field and then a whole group", async () => {
    await putGroups(INITIAL_GROUPS);

    const withoutField = structuredClone(INITIAL_GROUPS);
    withoutField[0]!.fields = [{ label: "Grupo", value: "Shimano Dura-Ace Di2", order: 0 }];
    await putGroups(withoutField);

    let groups = await readSpecGroups();
    expect(groups[0]?.fields).toHaveLength(1);

    await putGroups([withoutField[0]]);
    groups = await readSpecGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0]?.title).toBe("Transmisión");

    // An empty array legitimately clears the whole sheet.
    await putGroups([]);
    groups = await readSpecGroups();
    expect(groups).toHaveLength(0);
  });

  it("caps the number of groups", async () => {
    const tooMany = Array.from({ length: MAX_SPEC_GROUPS + 1 }, (_, index) => ({
      title: `Grupo ${index}`,
      order: index,
      fields: [],
    }));

    const response = await putGroups(tooMany);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain(String(MAX_SPEC_GROUPS));
  });

  it("escapes a script injected into a spec value", async () => {
    await putGroups([
      {
        title: "Transmisión",
        order: 0,
        fields: [{ label: "Grupo", value: '<script>alert("xss")</script>Shimano', order: 0 }],
      },
    ]);

    // Verified against the DB: the global sanitizeInput middleware escaped the
    // value before it ever reached the service, so nothing executable is stored.
    const stored = await Bike.findById(bikeId).exec();
    const value = stored?.specGroups[0]?.fields[0]?.value ?? "";
    expect(value).not.toContain("<script>");
    expect(value).toContain("&lt;script&gt;");
  });

  it("rejects a group with no title", async () => {
    const response = await putGroups([{ order: 0, fields: [] }]);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("título");
  });

  /**
   * M10.6. A saved template is a superset — "Eléctrica" carries every row an
   * e-bike could need — so a non-electric bike has to be able to turn rows off
   * *without deleting them*, and a row applied from a template but not filled
   * in yet must not block the save. That's what makes `visible` worth storing
   * instead of just deleting the row, and what forced `value` to accept blank.
   */
  describe("visibility (M10.6)", () => {
    const MIXED_GROUPS = [
      {
        title: "Frenos",
        order: 0,
        visible: true,
        fields: [
          { label: "Delantero", value: "SRAM RED E1", order: 0, visible: true },
          { label: "Trasero", value: "SRAM RED E1", order: 1, visible: false },
          { label: "Sin llenar", value: "", order: 2, visible: true },
        ],
      },
      {
        title: "Eléctrica",
        order: 1,
        visible: false,
        fields: [{ label: "Batería", value: "720 Wh", order: 0, visible: true }],
      },
    ];

    it("stores a hidden group, a hidden field and a blank value", async () => {
      const response = await putGroups(MIXED_GROUPS);
      expect(response.status).toBe(200);

      // Re-read through the admin DTO, which must keep everything so the
      // editor can turn it back on.
      const groups = (await readSpecGroups()) as unknown as typeof MIXED_GROUPS;
      expect(groups).toHaveLength(2);
      expect(groups[1]?.visible).toBe(false);
      expect(groups[0]?.fields[1]?.visible).toBe(false);
      expect(groups[0]?.fields[2]?.value).toBe("");
    });

    it("hides all of it from the storefront DTO", async () => {
      await putGroups(MIXED_GROUPS);

      const stored = await Bike.findById(bikeId).exec();
      const response = await request(app).get(`/api/v1/catalog/bikes/${stored!.slug}`);

      expect(response.status).toBe(200);
      const groups = response.body.data.bike.specGroups as typeof MIXED_GROUPS;
      // "Eléctrica" is gone entirely; "Frenos" keeps only the row that is both
      // visible and filled in.
      expect(groups).toHaveLength(1);
      expect(groups[0]?.title).toBe("Frenos");
      expect(groups[0]?.fields).toHaveLength(1);
      expect(groups[0]?.fields[0]?.label).toBe("Delantero");
    });

    it("drops a group whose every row is hidden or blank", async () => {
      await putGroups([
        {
          title: "Eléctrica",
          order: 0,
          visible: true,
          fields: [{ label: "Batería", value: "", order: 0, visible: true }],
        },
      ]);

      const stored = await Bike.findById(bikeId).exec();
      const response = await request(app).get(`/api/v1/catalog/bikes/${stored!.slug}`);

      // A heading with nothing under it is worse than no heading at all.
      expect(response.body.data.bike.specGroups).toHaveLength(0);
    });

    /**
     * The no-migration guarantee: documents written before `visible` existed
     * carry no such key, and must read back as visible rather than vanish
     * from the storefront. Written through the raw collection because the
     * model would apply the schema default and hide the regression.
     */
    it("treats a pre-M10.6 document with no `visible` key as visible", async () => {
      await Bike.collection.updateOne(
        { _id: new Types.ObjectId(bikeId) },
        { $set: { specGroups: [{ title: "Cuadro", order: 0, fields: [{ label: "Material", value: "Carbono", order: 0 }] }] } },
      );

      const stored = await Bike.findById(bikeId).exec();
      const response = await request(app).get(`/api/v1/catalog/bikes/${stored!.slug}`);

      expect(response.body.data.bike.specGroups).toHaveLength(1);
      expect(response.body.data.bike.specGroups[0].fields).toHaveLength(1);
    });
  });
});
