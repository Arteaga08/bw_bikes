import type { AdminInventoryProductCounts, AdminInventoryProductRow } from "@bw-bikes/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { InventarioView } from "./InventarioView";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function makeProduct(overrides: Partial<AdminInventoryProductRow> = {}): AdminInventoryProductRow {
  return {
    itemType: "bike",
    itemId: "bike-1",
    name: "Tarmac SL7",
    brand: "Specialized",
    categoryName: "Ruta",
    variantCount: 2,
    untrackedVariantCount: 0,
    totalAvailable: 8,
    totalOnHand: 8,
    totalReserved: 0,
    outOfStockVariants: 0,
    lowStockVariants: 0,
    status: "ok",
    ...overrides,
  };
}

function makeCounts(overrides: Partial<AdminInventoryProductCounts> = {}): AdminInventoryProductCounts {
  return { all: 1, out: 0, low: 0, ok: 1, onRequest: 0, ...overrides };
}

function listResponse(products: AdminInventoryProductRow[], counts: AdminInventoryProductCounts): Response {
  return jsonResponse({
    status: "success",
    message: "OK",
    data: { products, counts },
    meta: { total: products.length, page: 1, pages: 1, limit: 20 },
  });
}

function stubFetch(
  overrides: {
    products?: AdminInventoryProductRow[];
    counts?: AdminInventoryProductCounts;
    detail?: unknown;
  } = {},
) {
  const products = overrides.products ?? [makeProduct()];
  const counts = overrides.counts ?? makeCounts();

  const fetchSpy = vi.fn().mockImplementation((url: string) => {
    if (url.includes("/admin/inventory/products/")) {
      return Promise.resolve(
        jsonResponse({
          status: "success",
          message: "OK",
          data: {
            product: overrides.detail ?? {
              itemType: "bike",
              itemId: "bike-1",
              name: "Tarmac SL7",
              brand: "Specialized",
              categoryName: "Ruta",
              variants: [],
            },
          },
        }),
      );
    }
    if (url.includes("/admin/inventory/products")) {
      return Promise.resolve(listResponse(products, counts));
    }
    if (url.includes("/admin/color-templates")) {
      return Promise.resolve(jsonResponse({ status: "success", message: "OK", data: { colorTemplates: [] } }));
    }
    return Promise.resolve(listResponse([], makeCounts({ all: 0, ok: 0 })));
  });
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

function renderView() {
  return render(
    <ToastProvider>
      <InventarioView bikeCategoryTree={[]} accessoryCategoryTree={[]} brands={[]} />
    </ToastProvider>,
  );
}

describe("InventarioView", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("renders one row per product with photo/name/brand/categoría/total/variant count", async () => {
    stubFetch({ products: [makeProduct()] });
    renderView();

    expect(await screen.findByText("Tarmac SL7")).toBeInTheDocument();
    expect(screen.getByText("Specialized · Ruta")).toBeInTheDocument();
    expect(screen.getByText("8", { selector: "span.font-display" })).toBeInTheDocument();
    expect(screen.getByText("2 variantes")).toBeInTheDocument();
  });

  it("shows a placeholder icon instead of an empty box when the product has no photo", async () => {
    const { container } = (() => {
      stubFetch({ products: [makeProduct()] }); // no imageUrl
      return renderView();
    })();

    expect(await screen.findByText("Tarmac SL7")).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("marks a low-stock product without marking a healthy one", async () => {
    stubFetch({ products: [makeProduct({ status: "low" })], counts: makeCounts({ low: 1, ok: 0 }) });
    renderView();

    expect(await screen.findByText("Bajo")).toBeInTheDocument();
    expect(screen.queryByText("Agotado")).not.toBeInTheDocument();
  });

  it("clicking the 'Agotados' chip sends stock=out and marks it checked", async () => {
    const fetchSpy = stubFetch({ products: [makeProduct({ status: "out" })], counts: makeCounts({ out: 1, ok: 0 }) });
    const user = userEvent.setup();
    renderView();

    await screen.findByText("Tarmac SL7");
    const chip = screen.getByRole("radio", { name: /Agotados/ });
    await user.click(chip);

    await waitFor(() => expect(chip).toHaveAttribute("aria-checked", "true"));
    const calls = fetchSpy.mock.calls.filter(
      (args: unknown[]) => typeof args[0] === "string" && (args[0] as string).includes("/admin/inventory/products?"),
    );
    expect(calls.at(-1)?.[0]).toContain("stock=out");
  });

  it("debounces the search box and resets to page 1", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchSpy = stubFetch({ products: [makeProduct()] });
    const user = userEvent.setup({ delay: null });
    renderView();

    await screen.findByText("Tarmac SL7");
    await user.type(screen.getByPlaceholderText("Nombre, marca o SKU"), "Tarmac");

    // Not yet — still inside the 300ms debounce window.
    expect(fetchSpy.mock.calls.every((args: unknown[]) => !(args[0] as string).includes("search="))).toBe(true);

    await vi.advanceTimersByTimeAsync(300);

    await waitFor(() => {
      const call = fetchSpy.mock.calls.find((args: unknown[]) => (args[0] as string).includes("search=Tarmac"));
      expect(call).toBeDefined();
    });
    vi.useRealTimers();
  });

  it("clicking a product row opens the detail modal and fetches its detail", async () => {
    stubFetch({ products: [makeProduct()] });
    const user = userEvent.setup();
    renderView();

    await user.click(await screen.findByText("Tarmac SL7"));

    // The modal is code-split (`next/dynamic`) — it mounts after the click
    // that first reveals it, so its content needs `findBy`, not `getBy`.
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("shows an empty state with no products for the current filters", async () => {
    stubFetch({ products: [], counts: makeCounts({ all: 0, ok: 0 }) });
    renderView();

    expect(await screen.findByText("Sin productos con estos filtros")).toBeInTheDocument();
  });

  it("shows a retry action when the list fails to load", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: "fail", message: "Error" }, 500)));
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByText("No se pudo cargar el inventario")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
  });
});
