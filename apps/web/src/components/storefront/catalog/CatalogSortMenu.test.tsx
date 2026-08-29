import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { replaceMock, useSearchParamsMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  useSearchParamsMock: vi.fn(() => new URLSearchParams()),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/bicicletas",
  useSearchParams: useSearchParamsMock,
}));

const { CatalogSortMenu } = await import("./CatalogSortMenu");

describe("CatalogSortMenu", () => {
  // The "reflects the active sort" test below uses `mockReturnValue` (not
  // `-Once`, see its own comment), which would otherwise bleed into every
  // test that runs after it in this file.
  afterEach(() => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
  });

  it("shows a neutral trigger when no sort is active", () => {
    render(<CatalogSortMenu />);
    expect(screen.getByRole("button", { name: "Ordenar por" })).toBeInTheDocument();
  });

  it("opens on trigger click with exactly six sort options", () => {
    render(<CatalogSortMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));

    expect(screen.getAllByRole("radio")).toHaveLength(6);
    expect(screen.getByRole("radio", { name: "Novedades primero" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Favoritas primero" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Alfabéticamente, A-Z" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Alfabéticamente, Z-A" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Precio, menor a mayor" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Precio, mayor a menor" })).toBeInTheDocument();

    // The excluded reference options never render.
    expect(screen.queryByRole("radio", { name: "Características" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Fecha/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Más relevantes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Más vendidos" })).not.toBeInTheDocument();
  });

  it("writes the chosen sort to the URL and closes the panel", () => {
    render(<CatalogSortMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
    fireEvent.click(screen.getByRole("radio", { name: "Precio, menor a mayor" }));

    expect(replaceMock).toHaveBeenCalledWith("/bicicletas?sort=price", { scroll: false });
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("reflects the active sort on the trigger and marks its radio checked", () => {
    // `mockReturnValue`, not `-Once`: opening the panel causes a re-render
    // that calls `useSearchParams()` again, and a `-Once` mock would only
    // cover the first of those, silently reverting `filters.sort` on click.
    useSearchParamsMock.mockReturnValue(new URLSearchParams("sort=-price"));
    render(<CatalogSortMenu />);

    expect(screen.getByRole("button", { name: "Ordenar por: Precio, mayor a menor" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ordenar por: Precio, mayor a menor" }));
    expect(screen.getByRole("radio", { name: "Precio, mayor a menor" })).toBeChecked();
  });

  it("closes on Escape", () => {
    render(<CatalogSortMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
    expect(screen.getAllByRole("radio")).toHaveLength(6);

    fireEvent.keyDown(screen.getByRole("radio", { name: "Novedades primero" }), { key: "Escape" });
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("closes on an outside click", () => {
    render(
      <div>
        <button type="button">Afuera</button>
        <CatalogSortMenu />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
    expect(screen.getAllByRole("radio")).toHaveLength(6);

    fireEvent.mouseDown(screen.getByRole("button", { name: "Afuera" }));
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
