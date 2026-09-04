import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicProductSummary } from "@/lib/api/public-catalog";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const { searchCatalogMock } = vi.hoisted(() => ({ searchCatalogMock: vi.fn() }));
vi.mock("@/lib/api/catalog-search", () => ({ searchCatalog: searchCatalogMock }));

const { SearchDropdown } = await import("./SearchDropdown");

function summary(overrides: Partial<PublicProductSummary> = {}): PublicProductSummary {
  return {
    id: "bike-1",
    slug: "bw-smoke-ride",
    kind: "bike",
    name: "BW Smoke Ride",
    brand: { id: "brand-1", name: "BW Smoke Brand", slug: "bw-smoke-brand", order: 0 },
    price: 999900,
    badges: [],
    colors: [],
    gallery: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/** `vi.advanceTimersByTimeAsync` fires the debounce timer, but only `act` flushes the resulting `setState` (and, once a search fires, its resolved promise) into the DOM — same helper `use-debounced-value.test.tsx` uses. */
async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function openAndType(term: string): void {
  fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
  fireEvent.change(screen.getByPlaceholderText(/Buscar bicicletas o accesorios/), { target: { value: term } });
}

describe("SearchDropdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    searchCatalogMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders an enabled toggle, closed by default", () => {
    render(<SearchDropdown tone="neutral" />);

    expect(screen.getByRole("button", { name: "Buscar" })).toBeEnabled();
    expect(screen.queryByPlaceholderText(/Buscar bicicletas o accesorios/)).not.toBeInTheDocument();
  });

  it("prompts for more characters before searching", async () => {
    render(<SearchDropdown tone="neutral" />);
    openAndType("b");
    await advance(300);

    expect(screen.getByText("Sigue escribiendo para buscar…")).toBeInTheDocument();
    expect(searchCatalogMock).not.toHaveBeenCalled();
  });

  it("fetches once the debounce settles and groups results by catalog", async () => {
    searchCatalogMock.mockResolvedValue({ bikes: [summary()], accessories: [] });
    render(<SearchDropdown tone="neutral" />);
    openAndType("bw");

    await advance(300);
    expect(searchCatalogMock).toHaveBeenCalledWith("bw");

    expect(screen.getByText("Bicicletas")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /BW Smoke Ride/ })).toHaveAttribute(
      "href",
      "/bicicletas/producto/bw-smoke-ride",
    );
    expect(screen.queryByText("Accesorios")).not.toBeInTheDocument();
  });

  it("closes the panel once a result is clicked", async () => {
    searchCatalogMock.mockResolvedValue({ bikes: [summary()], accessories: [] });
    render(<SearchDropdown tone="neutral" />);
    openAndType("bw");
    await advance(300);

    fireEvent.click(screen.getByRole("option", { name: /BW Smoke Ride/ }));
    expect(screen.queryByPlaceholderText(/Buscar bicicletas o accesorios/)).not.toBeInTheDocument();
  });

  it("shows a no-results message when both catalogs come back empty", async () => {
    searchCatalogMock.mockResolvedValue({ bikes: [], accessories: [] });
    render(<SearchDropdown tone="neutral" />);
    openAndType("zzz");

    await advance(300);
    expect(screen.getByText(/No encontramos resultados para/)).toBeInTheDocument();
  });

  it("shows an error message when the search fails", async () => {
    searchCatalogMock.mockRejectedValue(new Error("network down"));
    render(<SearchDropdown tone="neutral" />);
    openAndType("bw");

    await advance(300);
    expect(screen.getByText("No pudimos completar la búsqueda. Intenta de nuevo.")).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(<SearchDropdown tone="neutral" />);
    openAndType("bw");
    expect(screen.getByPlaceholderText(/Buscar bicicletas o accesorios/)).toBeInTheDocument();

    fireEvent.keyDown(screen.getByPlaceholderText(/Buscar bicicletas o accesorios/), { key: "Escape" });
    expect(screen.queryByPlaceholderText(/Buscar bicicletas o accesorios/)).not.toBeInTheDocument();
  });

  it("closes on an outside click", () => {
    render(
      <div>
        <button type="button">Afuera</button>
        <SearchDropdown tone="neutral" />
      </div>,
    );
    openAndType("bw");
    expect(screen.getByPlaceholderText(/Buscar bicicletas o accesorios/)).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("button", { name: "Afuera" }));
    expect(screen.queryByPlaceholderText(/Buscar bicicletas o accesorios/)).not.toBeInTheDocument();
  });

  it("resets the query and results each time it reopens", async () => {
    searchCatalogMock.mockResolvedValue({ bikes: [summary()], accessories: [] });
    render(<SearchDropdown tone="neutral" />);
    openAndType("bw");
    await advance(300);
    expect(screen.getByText("Bicicletas")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(screen.getByPlaceholderText(/Buscar bicicletas o accesorios/)).toHaveValue("");
    expect(screen.queryByText("Bicicletas")).not.toBeInTheDocument();
  });
});
