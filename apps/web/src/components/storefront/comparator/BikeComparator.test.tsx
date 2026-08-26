import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComparableBike, ComparatorOption } from "@/lib/api/public-catalog";
import { BikeComparator } from "./BikeComparator";

function makeBike(slug: string, name: string, grupo: string): ComparableBike {
  return {
    id: slug,
    slug,
    name,
    brandName: "Specialized",
    price: 3_890_000,
    image: { url: `https://res.cloudinary.com/test/${slug}.jpg` },
    specGroups: [{ title: "Transmisión", fields: [{ label: "Grupo", value: grupo }] }],
  };
}

const TARMAC = makeBike("tarmac", "Tarmac SL7", "Ultegra Di2");
const ALLEZ = makeBike("allez", "Allez Sport", "Claris");
const EPIC = makeBike("epic", "Epic Evo", "SRAM GX");

const OPTIONS: ComparatorOption[] = [
  { slug: "tarmac", name: "Tarmac SL7", brandName: "Specialized" },
  { slug: "allez", name: "Allez Sport", brandName: "Specialized" },
  { slug: "epic", name: "Epic Evo", brandName: "Specialized" },
];

function renderComparator() {
  return render(<BikeComparator options={OPTIONS} initialPair={[TARMAC, ALLEZ]} />);
}

function mockFetchOnce(body: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, json: async () => body });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BikeComparator", () => {
  it("renders the server-provided pair without fetching anything", () => {
    const fetchMock = mockFetchOnce({});
    renderComparator();

    expect(screen.getByText("Tarmac SL7")).toBeInTheDocument();
    expect(screen.getByText("Allez Sport")).toBeInTheDocument();
    expect(screen.getByText("Ultegra Di2")).toBeInTheDocument();
    expect(screen.getByText("Claris")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("swaps only the side whose picker changed", async () => {
    const fetchMock = mockFetchOnce({ data: { bike: EPIC } });
    renderComparator();

    fireEvent.change(screen.getByLabelText("Primera bicicleta"), { target: { value: "epic" } });

    await waitFor(() => expect(screen.getByText("Epic Evo")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/catalog/bikes/epic", expect.anything());
    // El otro lado no se movió.
    expect(screen.getByText("Allez Sport")).toBeInTheDocument();
    expect(screen.queryByText("Tarmac SL7")).not.toBeInTheDocument();
    expect(screen.getByText("SRAM GX")).toBeInTheDocument();
  });

  it("keeps the previous bike on screen when the fetch fails", async () => {
    mockFetchOnce({ status: "fail", message: "No encontrada.", data: null }, false);
    renderComparator();

    fireEvent.change(screen.getByLabelText("Primera bicicleta"), { target: { value: "epic" } });

    await waitFor(() =>
      expect(screen.getByText("No pudimos cargar esa bicicleta. Intenta de nuevo.")).toBeInTheDocument(),
    );
    expect(screen.getByText("Tarmac SL7")).toBeInTheDocument();
    expect(screen.getByText("Ultegra Di2")).toBeInTheDocument();
  });

  it("keeps the previous bike when the response carries no bike", async () => {
    mockFetchOnce({ status: "success", data: {} });
    renderComparator();

    fireEvent.change(screen.getByLabelText("Segunda bicicleta"), { target: { value: "epic" } });

    await waitFor(() =>
      expect(screen.getByText("No pudimos cargar esa bicicleta. Intenta de nuevo.")).toBeInTheDocument(),
    );
    expect(screen.getByText("Allez Sport")).toBeInTheDocument();
  });

  it("disables the bike already chosen on the opposite side", () => {
    mockFetchOnce({});
    renderComparator();

    const left = screen.getByLabelText("Primera bicicleta");
    const right = screen.getByLabelText("Segunda bicicleta");

    // La izquierda no puede volver a elegir la bici de la derecha, y viceversa.
    expect(left.querySelector<HTMLOptionElement>('option[value="allez"]')?.disabled).toBe(true);
    expect(left.querySelector<HTMLOptionElement>('option[value="tarmac"]')?.disabled).toBe(false);
    expect(right.querySelector<HTMLOptionElement>('option[value="tarmac"]')?.disabled).toBe(true);
    expect(right.querySelector<HTMLOptionElement>('option[value="epic"]')?.disabled).toBe(false);
  });

  it("ignores a response that lands after a newer pick on the same side", async () => {
    // La primera petición contesta tarde; la segunda gana y debe quedarse.
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ ok: true, json: async () => ({ data: { bike: EPIC } }) }), 30),
          ),
      )
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { bike: ALLEZ } }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<BikeComparator options={OPTIONS} initialPair={[TARMAC, EPIC]} />);
    const left = screen.getByLabelText("Primera bicicleta");

    fireEvent.change(left, { target: { value: "epic" } });
    fireEvent.change(left, { target: { value: "allez" } });

    await waitFor(() => expect(screen.getByText("Allez Sport")).toBeInTheDocument());
    await new Promise((resolve) => setTimeout(resolve, 60));
    // La respuesta rezagada de "epic" no debe reemplazar a la ganadora.
    expect(screen.getByText("Allez Sport")).toBeInTheDocument();
  });
});
