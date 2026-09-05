import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicProductSummary } from "@/lib/api/public-catalog";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const { searchCatalogMock } = vi.hoisted(() => ({ searchCatalogMock: vi.fn() }));
vi.mock("@/lib/api/catalog-search", () => ({ searchCatalog: searchCatalogMock }));

const { SearchDropdown } = await import("./SearchDropdown");

// `SearchDropdownPanel` is code-split (`next/dynamic`) — same warmup
// reasoning as `MobileMenu.test.tsx`. Belt-and-suspenders alongside
// `shouldAdvanceTime` below: that fixes the fake-timer deadlock, this keeps
// the cold transform out of the timed assertions entirely.
beforeAll(async () => {
  await import("./SearchDropdownPanel");
});

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

/**
 * `SearchDropdownPanel` is code-split (`next/dynamic`, M-optimización) and
 * only mounts once the dropdown opens, so the input isn't in the DOM the
 * instant the toggle is clicked — `findByPlaceholderText` waits for it.
 */
async function openAndType(term: string): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
  const input = await screen.findByPlaceholderText(/Buscar bicicletas o accesorios/);
  fireEvent.change(input, { target: { value: term } });
}

describe("SearchDropdown", () => {
  beforeEach(() => {
    // `{ shouldAdvanceTime: true }` mirrors `InventarioView.test.tsx`'s own
    // fake-timer setup — without it, a component behind `next/dynamic`
    // never resolves: `vi.advanceTimersByTimeAsync` fast-forwards the fake
    // clock without ever yielding to Node's real event loop, so the pending
    // dynamic `import()` (real I/O under the hood) never gets a turn to
    // finish. `shouldAdvanceTime` runs the fake clock forward on a real
    // interval instead, which does yield.
    vi.useFakeTimers({ shouldAdvanceTime: true });
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
    await openAndType("b");
    await advance(300);

    expect(screen.getByText("Sigue escribiendo para buscar…")).toBeInTheDocument();
    expect(searchCatalogMock).not.toHaveBeenCalled();
  });

  it("fetches once the debounce settles and groups results by catalog", async () => {
    searchCatalogMock.mockResolvedValue({ bikes: [summary()], accessories: [] });
    render(<SearchDropdown tone="neutral" />);
    await openAndType("bw");

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
    await openAndType("bw");
    await advance(300);

    fireEvent.click(screen.getByRole("option", { name: /BW Smoke Ride/ }));
    expect(screen.queryByPlaceholderText(/Buscar bicicletas o accesorios/)).not.toBeInTheDocument();
  });

  it("shows a no-results message when both catalogs come back empty", async () => {
    searchCatalogMock.mockResolvedValue({ bikes: [], accessories: [] });
    render(<SearchDropdown tone="neutral" />);
    await openAndType("zzz");

    await advance(300);
    expect(screen.getByText(/No encontramos resultados para/)).toBeInTheDocument();
  });

  it("shows an error message when the search fails", async () => {
    searchCatalogMock.mockRejectedValue(new Error("network down"));
    render(<SearchDropdown tone="neutral" />);
    await openAndType("bw");

    await advance(300);
    expect(screen.getByText("No pudimos completar la búsqueda. Intenta de nuevo.")).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    render(<SearchDropdown tone="neutral" />);
    await openAndType("bw");
    expect(screen.getByPlaceholderText(/Buscar bicicletas o accesorios/)).toBeInTheDocument();

    fireEvent.keyDown(screen.getByPlaceholderText(/Buscar bicicletas o accesorios/), { key: "Escape" });
    expect(screen.queryByPlaceholderText(/Buscar bicicletas o accesorios/)).not.toBeInTheDocument();
  });

  it("closes on an outside click", async () => {
    render(
      <div>
        <button type="button">Afuera</button>
        <SearchDropdown tone="neutral" />
      </div>,
    );
    await openAndType("bw");
    expect(screen.getByPlaceholderText(/Buscar bicicletas o accesorios/)).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("button", { name: "Afuera" }));
    expect(screen.queryByPlaceholderText(/Buscar bicicletas o accesorios/)).not.toBeInTheDocument();
  });

  it("resets the query and results each time it reopens", async () => {
    searchCatalogMock.mockResolvedValue({ bikes: [summary()], accessories: [] });
    render(<SearchDropdown tone="neutral" />);
    await openAndType("bw");
    await advance(300);
    expect(screen.getByText("Bicicletas")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(screen.getByPlaceholderText(/Buscar bicicletas o accesorios/)).toHaveValue("");
    expect(screen.queryByText("Bicicletas")).not.toBeInTheDocument();
  });
});
