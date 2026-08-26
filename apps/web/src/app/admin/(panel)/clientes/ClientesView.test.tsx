import type { AdminCustomerSummary, CustomersStats } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { ClientesView } from "./ClientesView";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

function makeCustomer(overrides: Partial<AdminCustomerSummary> = {}): AdminCustomerSummary {
  return {
    id: "customer-1",
    email: "ana@example.com",
    firstName: "Ana",
    lastName: "Pérez",
    emailVerified: true,
    orderCount: 3,
    totalSpentCents: 150_000_00,
    lastOrderAt: new Date("2026-08-01").toISOString(),
    createdAt: new Date("2026-01-01").toISOString(),
    ...overrides,
  };
}

function makeStats(overrides: Partial<CustomersStats> = {}): CustomersStats {
  return {
    totalCustomers: 12,
    buyers: 7,
    repeatBuyers: 3,
    averageOrderCents: 45_000_00,
    topBuyers: [],
    ...overrides,
  };
}

/** The screen fires the list and the stats concurrently; both need a fresh `Response`. */
function stub(customers: AdminCustomerSummary[], stats: CustomersStats = makeStats()): ReturnType<typeof vi.fn> {
  const fetchSpy = vi.fn().mockImplementation((url: string) => {
    if (url.includes("/admin/stats/customers")) {
      return Promise.resolve(jsonResponse({ status: "success", message: "ok", data: { stats } }));
    }
    return Promise.resolve(
      jsonResponse({
        status: "success",
        message: "Clientes obtenidos.",
        data: { customers },
        meta: { total: customers.length, page: 1, pages: 1, limit: 20 },
      }),
    );
  });
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

function renderView() {
  return render(
    <ToastProvider>
      <ClientesView />
    </ToastProvider>,
  );
}

describe("ClientesView", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the empty state when no customer matches", async () => {
    stub([]);
    renderView();

    expect(await screen.findByText("No hay clientes con estos filtros")).toBeInTheDocument();
  });

  it("renders a customer with their purchase count and lifetime value", async () => {
    stub([makeCustomer()]);
    renderView();

    expect(await screen.findByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(screen.getByText("$150,000.00")).toBeInTheDocument();
  });

  it("falls back to the email when the account has no name", async () => {
    stub([makeCustomer({ firstName: "", lastName: "" })]);
    renderView();

    expect(await screen.findAllByText("ana@example.com")).not.toHaveLength(0);
  });

  it("shows an em dash rather than a blank for a customer who never bought", async () => {
    stub([makeCustomer({ orderCount: 0, totalSpentCents: 0, lastOrderAt: undefined })]);
    renderView();

    expect(await screen.findByText("—")).toBeInTheDocument();
  });

  it("surfaces the repeat-buyer segment the shop asked for", async () => {
    // A distinct count from the row's own `orderCount`, so the assertion can
    // only match the tile.
    stub([makeCustomer()], makeStats({ repeatBuyers: 9 }));
    renderView();

    const tile = (await screen.findByText("Compradores recurrentes")).closest("button");
    expect(tile).not.toBeNull();
    expect(tile).toHaveTextContent("9");
    expect(tile).toHaveTextContent("Más de una compra");
  });

  /** The tiles are filters, not decoration — that is the whole point of them. */
  it("filters the table to repeat buyers when its tile is clicked", async () => {
    const fetchSpy = stub([makeCustomer()]);
    renderView();

    await screen.findByText("Ana Pérez");
    await userEvent.click(screen.getByText("Compradores recurrentes"));

    expect(
      fetchSpy.mock.calls.some(([url]) => typeof url === "string" && url.includes("repeatBuyersOnly=true")),
    ).toBe(true);
  });

  it("renders the top-buyer ranking when there is one", async () => {
    stub(
      [makeCustomer()],
      makeStats({
        topBuyers: [
          {
            userId: "customer-1",
            name: "Ana Pérez",
            email: "ana@example.com",
            orderCount: 3,
            totalSpentCents: 150_000_00,
            lastOrderAt: new Date().toISOString(),
          },
        ],
      }),
    );
    renderView();

    expect(await screen.findByText("Mejores compradores")).toBeInTheDocument();
  });

  it("hides the ranking entirely when nobody has bought yet", async () => {
    stub([makeCustomer()], makeStats({ topBuyers: [] }));
    renderView();

    await screen.findByText("Ana Pérez");
    expect(screen.queryByText("Mejores compradores")).not.toBeInTheDocument();
  });

  it("offers to send a coupon to a single customer from their row", async () => {
    stub([makeCustomer()]);
    renderView();

    await screen.findByText("Ana Pérez");
    expect(screen.getAllByRole("button", { name: "Enviar cupón" }).length).toBeGreaterThan(0);
  });

  it("reveals the bulk action bar once customers are selected", async () => {
    stub([makeCustomer(), makeCustomer({ id: "customer-2", email: "beto@example.com", firstName: "Beto" })]);
    renderView();

    await screen.findByText("Ana Pérez");
    await userEvent.click(screen.getByLabelText("Seleccionar Ana Pérez"));

    expect(await screen.findByText("1 cliente seleccionado")).toBeInTheDocument();
  });

  it("selects every visible row from the header checkbox", async () => {
    stub([makeCustomer(), makeCustomer({ id: "customer-2", email: "beto@example.com", firstName: "Beto" })]);
    renderView();

    await screen.findByText("Ana Pérez");
    await userEvent.click(screen.getAllByLabelText("Seleccionar todos")[0]!);

    expect(await screen.findByText("2 clientes seleccionados")).toBeInTheDocument();
  });

  /**
   * A selection made on one filter must not survive into another — the admin
   * would be acting on rows they can no longer see.
   */
  it("clears the selection when the filter changes", async () => {
    stub([makeCustomer()]);
    renderView();

    await screen.findByText("Ana Pérez");
    await userEvent.click(screen.getByLabelText("Seleccionar Ana Pérez"));
    await screen.findByText("1 cliente seleccionado");

    await userEvent.click(screen.getByText("Compradores recurrentes"));

    expect(screen.queryByText("1 cliente seleccionado")).not.toBeInTheDocument();
  });
});
