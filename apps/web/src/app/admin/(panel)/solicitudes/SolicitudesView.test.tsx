import type { AdminApplication } from "@bw-bikes/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { SolicitudesView } from "./SolicitudesView";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function makeApplication(overrides: Partial<AdminApplication> = {}): AdminApplication {
  return {
    id: "app-1",
    type: "ambassador",
    status: "pending",
    applicant: { id: "user-1", email: "ana@example.com", firstName: "Ana", lastName: "Pérez" },
    ambassador: {
      discipline: "Ruta",
      city: "CDMX",
      socialMediaHandle: "@ana",
      followersApprox: 5000,
      motivation: "Quiero representar la marca.",
    },
    attachments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function listResponse(applications: AdminApplication[]): Response {
  return jsonResponse({
    status: "success",
    message: "Solicitudes obtenidas.",
    data: { applications },
    meta: { total: applications.length, page: 1, pages: 1, limit: 20 },
  });
}

function renderView() {
  return render(
    <ToastProvider>
      <SolicitudesView />
    </ToastProvider>,
  );
}

describe("SolicitudesView", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("shows the empty state for the Pendientes queue when there are none", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(listResponse([])));
    renderView();

    expect(await screen.findByText("No hay solicitudes pendientes")).toBeInTheDocument();
  });

  it("renders a pending application row", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(listResponse([makeApplication()])));
    renderView();

    expect(await screen.findByText("Ana Pérez")).toBeInTheDocument();
    // "Embajador" also appears as a <Select> option — scope to the table cell.
    expect(screen.getByRole("cell", { name: "Embajador" })).toBeInTheDocument();
  });

  it("approves an application end to end: POST real → toast → refetch", async () => {
    const application = makeApplication();
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.startsWith("/api/v1/admin/applications/app-1/approve")) {
        return Promise.resolve(
          jsonResponse({ status: "success", message: "Solicitud aprobada.", data: { application: { ...application, status: "approved" } } }),
        );
      }
      if (url === "/api/v1/admin/applications/app-1") {
        return Promise.resolve(jsonResponse({ status: "success", message: "OK", data: { application } }));
      }
      return Promise.resolve(listResponse([application]));
    });
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();

    renderView();

    await user.click(await screen.findByRole("button", { name: "Ver detalle" }));
    await user.click(await screen.findByRole("button", { name: "Aprobar" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/v1/admin/applications/app-1/approve",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText("Solicitud aprobada")).toBeInTheDocument();
  });
});
