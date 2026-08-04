import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { Bike, MAX_SPEC_GROUPS } from "../src/models/index.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { createBikeCategoryDoc } from "./helpers/factories.js";

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

    const created = await request(app).post(`${ADMIN}/bikes`).set("Cookie", adminCookie).send({
      name: "Tarmac SL8",
      brand: "Specialized",
      category: String(category._id),
      shortDescription: "Bici de ruta",
      description: "Descripción",
      price: 19_999_900,
      brakeType: "hydraulic_disc",
    });
    bikeId = created.body.data.bike._id as string;
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
});
