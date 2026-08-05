import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { Application, AuditLog } from "../src/models/index.js";
import { createAdminSession, createCustomerSession } from "./helpers/admin-session.js";
import { makePdfBuffer } from "./helpers/attachments.js";
import { stubCloudinary } from "./helpers/cloudinary.js";
import { makeJpegBuffer, makeTextBuffer } from "./helpers/images.js";

const APPLICATIONS = "/api/v1/applications";
const ADMIN = "/api/v1/admin";

type App = ReturnType<typeof buildApp>;

const AMBASSADOR_FIELDS = {
  discipline: "Ruta",
  city: "Ciudad de México",
  socialMediaHandle: "@ciclista.cdmx",
  followersApprox: "1500",
  motivation: "Quiero representar a la marca en competencias locales de ruta.",
};

const SPONSORSHIP_FIELDS = {
  eventName: "Gran Fondo CDMX",
  eventDate: "2026-11-15",
  venue: "Bosque de Chapultepec",
  expectedAttendees: "300",
  supportRequested: "Bicicletas de prueba y banners para el evento.",
};

function postAmbassador(app: App, cookie: string, overrides: Record<string, string> = {}) {
  const fields = { ...AMBASSADOR_FIELDS, ...overrides };
  let req = request(app).post(`${APPLICATIONS}/ambassador`).set("Cookie", cookie);
  for (const [key, value] of Object.entries(fields)) req = req.field(key, value);
  return req;
}

function postSponsorship(app: App, cookie: string, overrides: Record<string, string> = {}) {
  const fields = { ...SPONSORSHIP_FIELDS, ...overrides };
  let req = request(app).post(`${APPLICATIONS}/sponsorship`).set("Cookie", cookie);
  for (const [key, value] of Object.entries(fields)) req = req.field(key, value);
  return req;
}

describe("ambassador and sponsorship applications (M6)", () => {
  let app: App;
  let cookie: string;
  let adminCookie: string;

  beforeEach(async () => {
    app = buildApp();
    stubCloudinary();
    cookie = await createCustomerSession(app, "applicant@example.com");
    adminCookie = await createAdminSession(app);
  });

  describe("submitting an ambassador application", () => {
    it("accepts a submission with no attachments at all", async () => {
      const res = await postAmbassador(app, cookie);

      expect(res.status).toBe(201);
      expect(res.body.data.application).toMatchObject({
        type: "ambassador",
        status: "pending",
        ambassador: { discipline: "Ruta" },
        attachments: [],
      });
    });

    it("accepts a submission with an image and a PDF attachment", async () => {
      const jpeg = await makeJpegBuffer();
      const pdf = makePdfBuffer();

      const res = await postAmbassador(app, cookie)
        .attach("attachments", jpeg, { filename: "foto.jpg", contentType: "image/jpeg" })
        .attach("attachments", pdf, { filename: "propuesta.pdf", contentType: "application/pdf" });

      expect(res.status).toBe(201);
      expect(res.body.data.application.attachments).toHaveLength(2);
      expect(res.body.data.application.attachments.map((a: { format: string }) => a.format).sort()).toEqual([
        "image",
        "pdf",
      ]);
      // Signed, not a bare guessable URL.
      for (const attachment of res.body.data.application.attachments) {
        expect(attachment.url).toBeTruthy();
      }
    });

    it("rejects a PDF renamed to .jpg, without ever calling Cloudinary", async () => {
      const pdf = makePdfBuffer();
      const cloudinary = stubCloudinary();

      const res = await postAmbassador(app, cookie).attach("attachments", pdf, {
        filename: "foto.jpg",
        contentType: "image/jpeg",
      });

      expect(res.status).toBe(400);
      expect(cloudinary.uploadSpy).not.toHaveBeenCalled();
      expect(await Application.countDocuments()).toBe(0);
    });

    it("rejects a non-attachment file renamed to .pdf", async () => {
      const res = await postAmbassador(app, cookie).attach("attachments", makeTextBuffer(), {
        filename: "documento.pdf",
        contentType: "application/pdf",
      });

      expect(res.status).toBe(400);
    });

    it("escapes an XSS payload in a text field", async () => {
      const res = await postAmbassador(app, cookie, { motivation: '<script>alert("x")</script> me encanta andar en bici' });

      expect(res.status).toBe(201);
      const stored = await Application.findById(res.body.data.application.id).exec();
      expect(stored?.ambassador?.motivation).not.toContain("<script>");
    });

    it("requires authentication", async () => {
      let req = request(app).post(`${APPLICATIONS}/ambassador`);
      for (const [key, value] of Object.entries(AMBASSADOR_FIELDS)) req = req.field(key, value);
      const res = await req;
      expect(res.status).toBe(401);
    });

    it("validates required fields", async () => {
      const res = await postAmbassador(app, cookie, { motivation: "" });
      expect(res.status).toBe(400);
    });
  });

  describe("submitting a sponsorship application", () => {
    it("accepts a valid submission", async () => {
      const res = await postSponsorship(app, cookie);

      expect(res.status).toBe(201);
      expect(res.body.data.application).toMatchObject({
        type: "event_sponsorship",
        status: "pending",
        sponsorship: { eventName: "Gran Fondo CDMX", venue: "Bosque de Chapultepec" },
      });
    });
  });

  describe("one live application per type", () => {
    it("refuses a second submission while one is still pending", async () => {
      await postAmbassador(app, cookie);
      const res = await postAmbassador(app, cookie);

      expect(res.status).toBe(409);
    });

    it("lets two different applicants have their own pending application", async () => {
      const other = await createCustomerSession(app, "other-applicant@example.com");
      const first = await postAmbassador(app, cookie);
      const second = await postAmbassador(app, other);

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
    });

    it("resolves a simultaneous double submission to exactly one success", async () => {
      const [a, b] = await Promise.all([postAmbassador(app, cookie), postAmbassador(app, cookie)]);

      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual([201, 409]);
      expect(await Application.countDocuments({ status: "pending" })).toBe(1);
    });

    it("refuses a submission once the same type was already approved", async () => {
      const created = await postAmbassador(app, cookie);
      await request(app).post(`${ADMIN}/applications/${created.body.data.application.id}/approve`).set("Cookie", adminCookie);

      const res = await postAmbassador(app, cookie);
      expect(res.status).toBe(409);
    });
  });

  describe("PATCH review — approve and reject", () => {
    it("approves a pending application", async () => {
      const created = await postAmbassador(app, cookie);

      const res = await request(app)
        .post(`${ADMIN}/applications/${created.body.data.application.id}/approve`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.application.status).toBe("approved");
    });

    it("rejects a request to reject with an empty reason", async () => {
      const created = await postAmbassador(app, cookie);

      const empty = await request(app)
        .post(`${ADMIN}/applications/${created.body.data.application.id}/reject`)
        .set("Cookie", adminCookie)
        .send({});
      const blank = await request(app)
        .post(`${ADMIN}/applications/${created.body.data.application.id}/reject`)
        .set("Cookie", adminCookie)
        .send({ reason: "   " });

      expect(empty.status).toBe(400);
      expect(blank.status).toBe(400);
    });

    it("rejects with a reason, recording it and the timestamp", async () => {
      const created = await postAmbassador(app, cookie);

      const res = await request(app)
        .post(`${ADMIN}/applications/${created.body.data.application.id}/reject`)
        .set("Cookie", adminCookie)
        .send({ reason: "El perfil no cumple con el número mínimo de seguidores." });

      expect(res.status).toBe(200);
      expect(res.body.data.application.status).toBe("rejected");
      expect(res.body.data.application.rejectionReason).toContain("seguidores");

      const stored = await Application.findById(created.body.data.application.id).exec();
      expect(stored?.rejectedAt).toBeTruthy();
      expect(await AuditLog.findOne({ action: "application.rejected" }).exec()).not.toBeNull();
    });

    it("refuses to re-decide an application that already has a final status", async () => {
      const created = await postAmbassador(app, cookie);
      const id = created.body.data.application.id as string;
      await request(app).post(`${ADMIN}/applications/${id}/approve`).set("Cookie", adminCookie);

      const res = await request(app).post(`${ADMIN}/applications/${id}/reject`).set("Cookie", adminCookie).send({
        reason: "Cambio de opinión",
      });

      expect(res.status).toBe(409);
    });

    it("refuses a customer and an anonymous caller", async () => {
      const created = await postAmbassador(app, cookie);
      const id = created.body.data.application.id as string;

      const asCustomer = await request(app).post(`${ADMIN}/applications/${id}/approve`).set("Cookie", cookie);
      const anonymous = await request(app).post(`${ADMIN}/applications/${id}/approve`);

      expect(asCustomer.status).toBe(403);
      expect(anonymous.status).toBe(401);
    });
  });

  describe("reapplication cooldown", () => {
    it("refuses an immediate reapplication after a rejection", async () => {
      const created = await postAmbassador(app, cookie);
      await request(app)
        .post(`${ADMIN}/applications/${created.body.data.application.id}/reject`)
        .set("Cookie", adminCookie)
        .send({ reason: "No cumple los requisitos por ahora." });

      const res = await postAmbassador(app, cookie);
      expect(res.status).toBe(409);
    });

    it("allows reapplication once the cooldown has passed", async () => {
      const created = await postAmbassador(app, cookie);
      await request(app)
        .post(`${ADMIN}/applications/${created.body.data.application.id}/reject`)
        .set("Cookie", adminCookie)
        .send({ reason: "No cumple los requisitos por ahora." });

      // Backdate past the fixture cooldown (90 days, vitest.config.ts).
      await Application.updateOne(
        { _id: created.body.data.application.id },
        { $set: { rejectedAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000) } },
      ).exec();

      const res = await postAmbassador(app, cookie);
      expect(res.status).toBe(201);
    });

    it("a rejection on one application type doesn't block the other", async () => {
      const created = await postAmbassador(app, cookie);
      await request(app)
        .post(`${ADMIN}/applications/${created.body.data.application.id}/reject`)
        .set("Cookie", adminCookie)
        .send({ reason: "No por ahora." });

      const res = await postSponsorship(app, cookie);
      expect(res.status).toBe(201);
    });
  });

  describe("GET /applications/mine", () => {
    it("lists only the caller's own applications", async () => {
      const other = await createCustomerSession(app, "mine-other@example.com");
      await postAmbassador(app, cookie);
      await postAmbassador(app, other);

      const res = await request(app).get(`${APPLICATIONS}/mine`).set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.applications).toHaveLength(1);
    });

    it("requires authentication", async () => {
      const res = await request(app).get(`${APPLICATIONS}/mine`);
      expect(res.status).toBe(401);
    });
  });

  describe("admin bandeja", () => {
    it("paginates and lets an admin see the applicant's identity", async () => {
      const created = await postAmbassador(app, cookie);

      const res = await request(app).get(`${ADMIN}/applications?page=1&limit=10`).set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
      const mine = res.body.data.applications.find((a: { id: string }) => a.id === created.body.data.application.id);
      expect(mine.applicant.email).toBe("applicant@example.com");
    });

    it("refuses a customer and an anonymous caller", async () => {
      const asCustomer = await request(app).get(`${ADMIN}/applications`).set("Cookie", cookie);
      const anonymous = await request(app).get(`${ADMIN}/applications`);

      expect(asCustomer.status).toBe(403);
      expect(anonymous.status).toBe(401);
    });
  });
});
