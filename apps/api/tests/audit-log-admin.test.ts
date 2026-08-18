import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createAdminSession, createCustomerSession } from "./helpers/admin-session.js";

const ADMIN = "/api/v1/admin";

type App = ReturnType<typeof buildApp>;

/** Triggers one real `settings.pricing_updated` audit entry, the cheapest known action to generate. */
async function writeOneAuditEntry(app: App, adminCookie: string, taxRateBps = 1600): Promise<void> {
  const res = await request(app)
    .put(`${ADMIN}/settings/pricing`)
    .set("Cookie", adminCookie)
    .send({ taxRateBps });
  expect(res.status).toBe(200);
}

describe("audit log viewer — superadmin only", () => {
  let app: App;

  beforeEach(() => {
    app = buildApp();
  });

  it("rejects an anonymous caller with 401", async () => {
    expect((await request(app).get(`${ADMIN}/audit-logs`)).status).toBe(401);
  });

  it("rejects a plain admin with 403 — this is the one route restricted beyond `admin`", async () => {
    const adminCookie = await createAdminSession(app, { role: "admin" });
    const res = await request(app).get(`${ADMIN}/audit-logs`).set("Cookie", adminCookie);
    expect(res.status).toBe(403);
  });

  it("rejects a customer with 403", async () => {
    const customerCookie = await createCustomerSession(app);
    const res = await request(app).get(`${ADMIN}/audit-logs`).set("Cookie", customerCookie);
    expect(res.status).toBe(403);
  });

  it("lets a superadmin read the trail, newest entry first", async () => {
    const superadminCookie = await createAdminSession(app, { role: "superadmin" });
    await writeOneAuditEntry(app, superadminCookie, 1600);
    await writeOneAuditEntry(app, superadminCookie, 1700);

    const res = await request(app).get(`${ADMIN}/audit-logs`).set("Cookie", superadminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.logs.length).toBeGreaterThanOrEqual(2);
    const [first, second] = res.body.data.logs as { createdAt: string }[];
    expect(new Date(first!.createdAt).getTime()).toBeGreaterThanOrEqual(new Date(second!.createdAt).getTime());
  });

  it("paginates with correct meta", async () => {
    const superadminCookie = await createAdminSession(app, { role: "superadmin" });
    for (let i = 0; i < 5; i++) await writeOneAuditEntry(app, superadminCookie, 1600 + i);

    const res = await request(app).get(`${ADMIN}/audit-logs?limit=2&page=1`).set("Cookie", superadminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.logs).toHaveLength(2);
    expect(res.body.meta.limit).toBe(2);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(5);
  });

  it("filters by module and by action", async () => {
    const superadminCookie = await createAdminSession(app, { role: "superadmin" });
    await writeOneAuditEntry(app, superadminCookie);

    const byModule = await request(app)
      .get(`${ADMIN}/audit-logs?module=settings`)
      .set("Cookie", superadminCookie);
    expect(byModule.status).toBe(200);
    expect((byModule.body.data.logs as { module: string }[]).every((entry) => entry.module === "settings")).toBe(
      true,
    );

    const byAction = await request(app)
      .get(`${ADMIN}/audit-logs?action=settings.pricing_updated`)
      .set("Cookie", superadminCookie);
    expect(byAction.status).toBe(200);
    expect(
      (byAction.body.data.logs as { action: string }[]).every((entry) => entry.action === "settings.pricing_updated"),
    ).toBe(true);

    const byOtherModule = await request(app)
      .get(`${ADMIN}/audit-logs?module=inventory`)
      .set("Cookie", superadminCookie);
    expect(byOtherModule.body.data.logs).toHaveLength(0);
  });

  it("filters by actorId", async () => {
    const superadminCookie = await createAdminSession(app, { role: "superadmin" });
    await writeOneAuditEntry(app, superadminCookie);

    const meRes = await request(app).get("/api/v1/auth/me").set("Cookie", superadminCookie);
    const actorId = meRes.body.data.user.id as string;

    const res = await request(app).get(`${ADMIN}/audit-logs?actorId=${actorId}`).set("Cookie", superadminCookie);

    expect(res.status).toBe(200);
    expect((res.body.data.logs as unknown[]).length).toBeGreaterThan(0);
    expect((res.body.data.logs as { actor: { id: string } | null }[])[0]!.actor?.id).toBe(actorId);
  });

  it("filters by a from/to date range", async () => {
    const superadminCookie = await createAdminSession(app, { role: "superadmin" });
    await writeOneAuditEntry(app, superadminCookie);

    const future = new Date(Date.now() + 60_000).toISOString();
    const nothingYet = await request(app)
      .get(`${ADMIN}/audit-logs?from=${future}`)
      .set("Cookie", superadminCookie);
    expect(nothingYet.body.data.logs).toHaveLength(0);

    const past = new Date(Date.now() - 60_000).toISOString();
    const includesIt = await request(app).get(`${ADMIN}/audit-logs?from=${past}`).set("Cookie", superadminCookie);
    expect((includesIt.body.data.logs as unknown[]).length).toBeGreaterThan(0);
  });

  it("rejects an action outside the known AuditAction union with 400", async () => {
    const superadminCookie = await createAdminSession(app, { role: "superadmin" });
    const res = await request(app)
      .get(`${ADMIN}/audit-logs?action=not.a.real.action`)
      .set("Cookie", superadminCookie);
    expect(res.status).toBe(400);
  });
});
