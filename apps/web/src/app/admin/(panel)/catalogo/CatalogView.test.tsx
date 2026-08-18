import type { AdminBike } from "@bw-bikes/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { CatalogView } from "./CatalogView";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function makeBike(overrides: Partial<AdminBike> = {}): AdminBike {
  return {
    id: "bike-1",
    name: "Tarmac SL8 Pro",
    slug: "tarmac-sl8-pro",
    brand: { id: "brand-1", name: "Specialized", slug: "specialized", order: 0 },
    category: { id: "cat-1", name: "Ruta", slug: "ruta", parent: null, order: 0, usesSizes: true },
    shortDescription: "Bici de ruta",
    summary: [],
    description: "Descripción",
    price: 19_999_900,
    currency: "MXN",
    variants: [],
    specGroups: [],
    gallery: [],
    badges: [],
    relatedAccessories: [],
    isActive: true,
    archivedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderView() {
  return render(
    <ToastProvider>
      <CatalogView kind="bike" categoryTree={[]} brands={[]} />
    </ToastProvider>,
  );
}

describe("CatalogView", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the empty state when there are no bikes for the current filters", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ status: "success", message: "OK", data: { bikes: [] }, meta: { total: 0, page: 1, pages: 1, limit: 20 } }),
      ),
    );

    renderView();

    expect(await screen.findByText("No hay bicicletas con estos filtros")).toBeInTheDocument();
  });

  it("renders a fetched bike as a card", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          status: "success",
          message: "OK",
          data: { bikes: [makeBike()] },
          meta: { total: 1, page: 1, pages: 1, limit: 20 },
        }),
      ),
    );

    renderView();

    expect(await screen.findByText("Tarmac SL8 Pro")).toBeInTheDocument();
    expect(screen.getByText("Specialized · Ruta")).toBeInTheDocument();
  });

  it("renders the card's edit action as a real link, not a bare button", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          status: "success",
          message: "OK",
          data: { bikes: [makeBike()] },
          meta: { total: 1, page: 1, pages: 1, limit: 20 },
        }),
      ),
    );

    renderView();

    await screen.findByText("Tarmac SL8 Pro");
    const editLink = screen.getByRole("link", { name: "Editar" });
    expect(editLink).toHaveAttribute("href", "/admin/catalogo/bicicletas/bike-1");
  });

  it("archiving a bike calls the endpoint, toasts success, and refetches the list", async () => {
    const bike = makeBike();
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/archive")) {
        return Promise.resolve(
          jsonResponse({ status: "success", message: "Bicicleta archivada.", data: { bike: { ...bike, isActive: false } } }),
        );
      }
      // Every GET /admin/bikes call, including the post-archive refetch.
      return Promise.resolve(
        jsonResponse({
          status: "success",
          message: "OK",
          data: { bikes: [bike] },
          meta: { total: 1, page: 1, pages: 1, limit: 20 },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchSpy);

    const user = userEvent.setup();
    renderView();

    await screen.findByText("Tarmac SL8 Pro");
    await user.click(screen.getByRole("button", { name: "Archivar" }));
    await user.click(screen.getByRole("button", { name: "Sí, archivar" }));

    await waitFor(() => {
      expect(screen.getByText("Producto archivado")).toBeInTheDocument();
    });

    const archiveCalls = fetchSpy.mock.calls.filter((call: unknown[]) => (call[0] as string).endsWith("/archive"));
    expect(archiveCalls).toHaveLength(1);
    expect(archiveCalls[0]?.[1]).toMatchObject({ method: "POST" });

    const listCalls = fetchSpy.mock.calls.filter((call: unknown[]) => (call[0] as string).includes("/admin/bikes?"));
    expect(listCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("does not offer Eliminar on an active bike", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          status: "success",
          message: "OK",
          data: { bikes: [makeBike()] },
          meta: { total: 1, page: 1, pages: 1, limit: 20 },
        }),
      ),
    );

    renderView();

    await screen.findByText("Tarmac SL8 Pro");
    expect(screen.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();
  });

  it("offers Eliminar alongside Restaurar on an archived bike", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          status: "success",
          message: "OK",
          data: { bikes: [makeBike({ isActive: false, archivedAt: new Date().toISOString() })] },
          meta: { total: 1, page: 1, pages: 1, limit: 20 },
        }),
      ),
    );

    renderView();

    await screen.findByText("Tarmac SL8 Pro");
    expect(screen.getByRole("button", { name: "Restaurar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeInTheDocument();
  });

  it("confirming Eliminar calls DELETE, toasts success, and refetches the list", async () => {
    const archivedBike = makeBike({ isActive: false, archivedAt: new Date().toISOString() });
    const fetchSpy = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return Promise.resolve(jsonResponse({ status: "success", message: "Bicicleta eliminada." }));
      }
      return Promise.resolve(
        jsonResponse({
          status: "success",
          message: "OK",
          data: { bikes: [archivedBike] },
          meta: { total: 1, page: 1, pages: 1, limit: 20 },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchSpy);

    const user = userEvent.setup();
    renderView();

    await screen.findByText("Tarmac SL8 Pro");
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    await user.click(screen.getByRole("button", { name: "Sí, eliminar" }));

    await waitFor(() => {
      expect(screen.getByText("Bicicleta eliminada")).toBeInTheDocument();
    });

    const deleteCalls = fetchSpy.mock.calls.filter((call: unknown[]) => (call[1] as RequestInit)?.method === "DELETE");
    expect(deleteCalls).toHaveLength(1);
    expect(deleteCalls[0]?.[0]).toBe("/api/v1/admin/bikes/bike-1");

    const listCalls = fetchSpy.mock.calls.filter((call: unknown[]) => (call[0] as string).includes("/admin/bikes?"));
    expect(listCalls.length).toBeGreaterThanOrEqual(2);
  });
});
