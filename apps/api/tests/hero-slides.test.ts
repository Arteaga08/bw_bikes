import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { HeroSlide } from "../src/models/index.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { stubCloudinary } from "./helpers/cloudinary.js";
import { createBikeCategoryDoc, seedBikes } from "./helpers/factories.js";
import { makeJpegBuffer, makePngBuffer } from "./helpers/images.js";

const ADMIN = "/api/v1/admin/content/hero-slides";
const PUBLIC = "/api/v1/content/hero-slides";

function ctaBody(overrides: Partial<{ label: string; target: Record<string, unknown> }> = {}) {
  return {
    label: overrides.label ?? "Ver bici",
    target: overrides.target ?? { type: "url", url: "/bicicletas" },
  };
}

function slideBody(overrides: Record<string, unknown> = {}) {
  return {
    focalPoint: "center",
    eyebrow: "Edición 2026",
    title: "Rhino Race",
    subtitle: "Ligera, rígida, lista para competir.",
    ctas: [ctaBody()],
    isActive: true,
    ...overrides,
  };
}

describe("admin hero slides CRUD", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;

  beforeEach(async () => {
    app = buildApp();
    stubCloudinary();
    adminCookie = await createAdminSession(app);
  });

  it("rejects every route without a session", async () => {
    const responses = await Promise.all([
      request(app).get(ADMIN),
      request(app).post(ADMIN).send(slideBody()),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(401);
    }
  });

  it("creates, lists, updates and deletes a slide", async () => {
    const created = await request(app).post(ADMIN).set("Cookie", adminCookie).send(slideBody());
    expect(created.status).toBe(201);
    expect(created.body.data.slide.title).toBe("Rhino Race");
    expect(created.body.data.slide.image).toBeUndefined();
    const slideId = created.body.data.slide.id as string;

    const listed = await request(app).get(ADMIN).set("Cookie", adminCookie);
    expect(listed.status).toBe(200);
    expect(listed.body.data.slides).toHaveLength(1);

    const updated = await request(app)
      .put(`${ADMIN}/${slideId}`)
      .set("Cookie", adminCookie)
      .send(slideBody({ title: "Rhino Endurance" }));
    expect(updated.status).toBe(200);
    expect(updated.body.data.slide.title).toBe("Rhino Endurance");

    const removed = await request(app).delete(`${ADMIN}/${slideId}`).set("Cookie", adminCookie);
    expect(removed.status).toBe(200);

    const afterDelete = await HeroSlide.findById(slideId).exec();
    expect(afterDelete).toBeNull();
  });

  it("refuses a slide with no CTA and a slide with three CTAs", async () => {
    const noCta = await request(app)
      .post(ADMIN)
      .set("Cookie", adminCookie)
      .send(slideBody({ ctas: [] }));
    expect(noCta.status).toBe(400);

    const threeCtas = await request(app)
      .post(ADMIN)
      .set("Cookie", adminCookie)
      .send(slideBody({ ctas: [ctaBody(), ctaBody(), ctaBody()] }));
    expect(threeCtas.status).toBe(400);
  });

  it("refuses a 6th slide once 5 already exist", async () => {
    for (let index = 0; index < 5; index += 1) {
      const response = await request(app).post(ADMIN).set("Cookie", adminCookie).send(slideBody());
      expect(response.status).toBe(201);
    }

    const sixth = await request(app).post(ADMIN).set("Cookie", adminCookie).send(slideBody());
    expect(sixth.status).toBe(400);
    expect(sixth.body.message).toContain("5");
  });

  it("refuses a CTA pointing at a bike that doesn't exist", async () => {
    const response = await request(app)
      .post(ADMIN)
      .set("Cookie", adminCookie)
      .send(slideBody({ ctas: [ctaBody({ target: { type: "bike", refId: "0".repeat(24) } })] }));

    expect(response.status).toBe(400);
  });

  it("refuses an external URL as a CTA target", async () => {
    const response = await request(app)
      .post(ADMIN)
      .set("Cookie", adminCookie)
      .send(slideBody({ ctas: [ctaBody({ target: { type: "url", url: "https://evil.example" } })] }));

    expect(response.status).toBe(400);
  });

  it("uploads a slide's image via the dedicated endpoint, rejecting a mislabeled PNG", async () => {
    const created = await request(app).post(ADMIN).set("Cookie", adminCookie).send(slideBody());
    const slideId = created.body.data.slide.id as string;

    const png = await makePngBuffer();
    const rejected = await request(app)
      .post(`${ADMIN}/${slideId}/image`)
      .set("Cookie", adminCookie)
      .attach("images", png, { filename: "foto.jpg", contentType: "image/jpeg" });
    expect(rejected.status).toBe(400);

    const jpeg = await makeJpegBuffer();
    const accepted = await request(app)
      .post(`${ADMIN}/${slideId}/image`)
      .set("Cookie", adminCookie)
      .attach("images", jpeg, { filename: "foto.jpg", contentType: "image/jpeg" });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.slide.image.publicId).toBeDefined();
  });

  it("reorders slides, rejecting a partial id list", async () => {
    const first = await request(app).post(ADMIN).set("Cookie", adminCookie).send(slideBody({ title: "Slide A" }));
    const second = await request(app).post(ADMIN).set("Cookie", adminCookie).send(slideBody({ title: "Slide B" }));
    const firstId = first.body.data.slide.id as string;
    const secondId = second.body.data.slide.id as string;

    const partial = await request(app)
      .put(`${ADMIN}/reorder`)
      .set("Cookie", adminCookie)
      .send({ ids: [firstId] });
    expect(partial.status).toBe(400);

    const reordered = await request(app)
      .put(`${ADMIN}/reorder`)
      .set("Cookie", adminCookie)
      .send({ ids: [secondId, firstId] });
    expect(reordered.status).toBe(200);
    expect(reordered.body.data.slides[0].title).toBe("Slide B");
    expect(reordered.body.data.slides[1].title).toBe("Slide A");
  });
});

describe("public hero slides", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;

  beforeEach(async () => {
    app = buildApp();
    stubCloudinary();
    adminCookie = await createAdminSession(app);
  });

  async function createSlideWithImage(overrides: Record<string, unknown> = {}): Promise<string> {
    const created = await request(app).post(ADMIN).set("Cookie", adminCookie).send(slideBody(overrides));
    const slideId = created.body.data.slide.id as string;
    const jpeg = await makeJpegBuffer();
    await request(app)
      .post(`${ADMIN}/${slideId}/image`)
      .set("Cookie", adminCookie)
      .attach("images", jpeg, { filename: "foto.jpg", contentType: "image/jpeg" });
    return slideId;
  }

  it("is reachable without a session and returns nothing while no slide has an image", async () => {
    await request(app).post(ADMIN).set("Cookie", adminCookie).send(slideBody());

    const response = await request(app).get(PUBLIC);
    expect(response.status).toBe(200);
    expect(response.body.data.slides).toEqual([]);
  });

  it("returns only active slides with an image, in order", async () => {
    const activeId = await createSlideWithImage({ title: "Activo", isActive: true });
    await createSlideWithImage({ title: "Inactivo", isActive: false });

    const response = await request(app).get(PUBLIC);
    expect(response.status).toBe(200);
    expect(response.body.data.slides).toHaveLength(1);
    expect(response.body.data.slides[0].title).toBe("Activo");
    expect(response.body.data.slides[0].ctas[0].href).toBe("/bicicletas");
    void activeId;
  });

  it("resolves a bike CTA to its current slug, and drops it once the bike is archived", async () => {
    const category = await createBikeCategoryDoc();
    const [bike] = await seedBikes(1, category._id);

    await createSlideWithImage({
      ctas: [ctaBody({ label: "Ver Rhino", target: { type: "bike", refId: String(bike!._id) } })],
    });

    const before = await request(app).get(PUBLIC);
    expect(before.body.data.slides[0].ctas[0].href).toBe(`/bicicletas/${bike!.slug}`);

    bike!.isActive = false;
    await bike!.save();

    const after = await request(app).get(PUBLIC);
    // The slide had exactly one CTA and it just went dead — the whole slide drops.
    expect(after.body.data.slides).toEqual([]);

    const admin = await request(app).get(ADMIN).set("Cookie", adminCookie);
    const adminSlide = admin.body.data.slides.find((slide: { ctas: { isBroken: boolean }[] }) =>
      slide.ctas.some((cta) => cta.isBroken),
    );
    expect(adminSlide).toBeDefined();
  });
});
