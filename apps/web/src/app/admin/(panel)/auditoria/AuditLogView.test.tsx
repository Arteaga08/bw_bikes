import type { AdminAuditLog } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuditLogView } from "./AuditLogView";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function makeEntry(overrides: Partial<AdminAuditLog> = {}): AdminAuditLog {
  return {
    id: "log-1",
    actorType: "user",
    actor: { id: "user-1", email: "admin@bnwbikes.com", firstName: "Admin", lastName: "Uno" },
    action: "settings.pricing_updated",
    module: "settings",
    targetId: null,
    before: { taxRateBps: 1600 },
    after: { taxRateBps: 1700 },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function listResponse(logs: AdminAuditLog[]): Response {
  return jsonResponse({
    status: "success",
    message: "Bitácora obtenida.",
    data: { logs },
    meta: { total: logs.length, page: 1, pages: 1, limit: 30 },
  });
}

describe("AuditLogView", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("shows the empty state when there are no entries", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(listResponse([])));
    render(<AuditLogView />);

    expect(await screen.findByText("Sin entradas con estos filtros")).toBeInTheDocument();
  });

  it("renders an entry row", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(listResponse([makeEntry()])));
    render(<AuditLogView />);

    expect(await screen.findByText("Admin Uno")).toBeInTheDocument();
    // "settings.pricing_updated" also appears as a <Select> option — scope to the table cell.
    expect(screen.getByRole("cell", { name: "settings.pricing_updated" })).toBeInTheDocument();
  });

  it("opens the detail slideover with before/after on Ver detalle", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(listResponse([makeEntry()])));
    const user = userEvent.setup();
    render(<AuditLogView />);

    await user.click(await screen.findByRole("button", { name: "Ver detalle" }));

    expect(screen.getByText(/"taxRateBps": 1600/)).toBeInTheDocument();
    expect(screen.getByText(/"taxRateBps": 1700/)).toBeInTheDocument();
  });
});
