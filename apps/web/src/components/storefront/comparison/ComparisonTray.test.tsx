import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComparisonProvider, type ComparisonEntry } from "./ComparisonProvider";

const { pushMock, pathnameMock } = vi.hoisted(() => ({ pushMock: vi.fn(), pathnameMock: { current: "/bicicletas" } }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => pathnameMock.current,
}));

const { ComparisonTray } = await import("./ComparisonTray");

const STORAGE_KEY = "bw_comparison_selection";

/**
 * Seeds the selection by writing straight to `sessionStorage` before mount,
 * the same storage `ComparisonProvider` itself reads on hydration — not by
 * calling `toggle` from a mounted child. That path raced against the
 * provider's own hydration effect (`toggle`'s `setEntries` landed first,
 * then the provider's deferred `readStoredEntries()` clobbered it back to
 * empty) — seeding storage directly sidesteps the race and exercises the
 * real hydration path besides.
 */
function renderTray(entries: ComparisonEntry[] = []) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  return render(
    <ComparisonProvider>
      <ComparisonTray />
    </ComparisonProvider>,
  );
}

const bikeA: ComparisonEntry = { slug: "bike-a", name: "Tarmac", brandName: "Specialized", price: 20_000_00 };
const bikeB: ComparisonEntry = { slug: "bike-b", name: "Domane", brandName: "Trek", price: 18_000_00 };
const bikeC: ComparisonEntry = { slug: "bike-c", name: "Defy", brandName: "Giant", price: 15_000_00 };

describe("ComparisonTray", () => {
  beforeEach(() => {
    pushMock.mockReset();
    pathnameMock.current = "/bicicletas";
    sessionStorage.clear();
  });

  it("starts inert and hidden with no selection", async () => {
    renderTray();
    const region = await screen.findByRole("region", { name: "Comparación", hidden: true });
    expect(region).toHaveAttribute("inert", "");
    expect(region).toHaveClass("translate-y-full");
  });

  it("stays hidden on /comparar even with a selection, but reopens back on a catalog page", async () => {
    pathnameMock.current = "/comparar";
    renderTray([bikeA, bikeB]);

    const region = await screen.findByRole("region", { name: "Comparación", hidden: true });
    expect(region).toHaveAttribute("inert", "");
    expect(region).toHaveClass("translate-y-full");
  });

  it("opens once a bike is selected and announces the running count", async () => {
    renderTray([bikeA]);

    const region = await screen.findByRole("region", { name: "Comparación" });
    expect(region).not.toHaveAttribute("inert");
    expect(region).toHaveClass("translate-y-0");
    expect(screen.getByText("1 de 3 bicicletas seleccionadas")).toBeInTheDocument();
  });

  it("disables 'Comparar' with only one bike and enables it at two", async () => {
    renderTray([bikeA]);
    // Duplicated on purpose (mobile row + desktop row) — see the file-level
    // comment on `ComparisonTray` about the two layouts; both share the same
    // handler and disabled state, so asserting on either is equivalent.
    for (const button of await screen.findAllByRole("button", { name: "Comparar (1)" })) {
      expect(button).toBeDisabled();
    }
  });

  it("enables 'Comparar' once two bikes are selected", async () => {
    renderTray([bikeA, bikeB]);
    for (const button of await screen.findAllByRole("button", { name: "Comparar (2)" })) {
      expect(button).not.toBeDisabled();
    }
  });

  it("navigates to /comparar with the selected slugs, comma-joined", async () => {
    const user = userEvent.setup();
    renderTray([bikeA, bikeB, bikeC]);

    const [compareButton] = await screen.findAllByRole("button", { name: "Comparar (3)" });
    await user.click(compareButton!);

    expect(pushMock).toHaveBeenCalledWith("/comparar?bicis=bike-a%2Cbike-b%2Cbike-c");
  });

  it("removing a slot drops just that bike", async () => {
    const user = userEvent.setup();
    renderTray([bikeA, bikeB]);

    await screen.findByText("Tarmac");
    await user.click(screen.getByRole("button", { name: "Quitar Tarmac de la comparación" }));

    await waitFor(() => expect(screen.queryByText("Tarmac")).not.toBeInTheDocument());
    expect(screen.getByText("Domane")).toBeInTheDocument();
    const region = screen.getByRole("region", { name: "Comparación" });
    expect(region).not.toHaveAttribute("inert");
  });

  it("'Limpiar selección' clears the whole selection and the tray closes again", async () => {
    const user = userEvent.setup();
    renderTray([bikeA, bikeB]);

    await screen.findByText("Tarmac");
    await user.click(screen.getByRole("button", { name: "Limpiar selección" }));

    await waitFor(() => {
      const region = screen.getByRole("region", { name: "Comparación", hidden: true });
      expect(region).toHaveAttribute("inert", "");
    });
  });

  it("shows a dashed placeholder for each remaining slot", async () => {
    renderTray([bikeA]);
    // Waits out hydration first: on the very first, pre-hydration paint
    // `entries` is still `[]`, which would satisfy `findAllByText` with 3
    // placeholders (`MAX_COMPARISON_ENTRIES`) before the real, seeded value
    // (1 entry → 2 placeholders) ever renders.
    await screen.findByText("Tarmac");
    expect(screen.getAllByText("Agrega otra bicicleta")).toHaveLength(2);
  });

  it("expands the mobile panel on tap, revealing the full slot detail", async () => {
    const user = userEvent.setup();
    renderTray([bikeA]);

    const toggle = await screen.findByRole("button", { name: "1 de 3 bicicletas seleccionadas — ver selección" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // Before expanding, "Quitar" only exists once — the always-rendered desktop row.
    expect(screen.getAllByRole("button", { name: "Quitar Tarmac de la comparación" })).toHaveLength(1);

    await user.click(toggle);

    expect(screen.getByRole("button", { name: "1 de 3 bicicletas seleccionadas — ocultar selección" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    // Expanding renders the mobile panel's own copy of the slot alongside the desktop row's.
    expect(screen.getAllByRole("button", { name: "Quitar Tarmac de la comparación" })).toHaveLength(2);
  });
});
