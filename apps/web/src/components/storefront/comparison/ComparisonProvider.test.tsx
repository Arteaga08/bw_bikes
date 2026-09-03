import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComparisonProvider, MAX_COMPARISON_ENTRIES, useComparison, type ComparisonEntry } from "./ComparisonProvider";

function entry(slug: string): ComparisonEntry {
  return { slug, name: `Bici ${slug}`, brandName: "Canyon", price: 1_000_00 };
}

function SelectionProbe() {
  const { entries, isSelected } = useComparison();
  return (
    <span>
      {entries.length} · {isSelected("a") ? "a-on" : "a-off"}
    </span>
  );
}

function Toggler({ slug }: { slug: string }) {
  const { toggle } = useComparison();
  return (
    <button type="button" onClick={() => toggle(entry(slug))}>
      Alternar {slug}
    </button>
  );
}

function Remover({ slug }: { slug: string }) {
  const { remove } = useComparison();
  return (
    <button type="button" onClick={() => remove(slug)}>
      Quitar {slug}
    </button>
  );
}

function Clearer() {
  const { clear } = useComparison();
  return (
    <button type="button" onClick={clear}>
      Limpiar
    </button>
  );
}

describe("ComparisonProvider", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("starts with no selection and lets a consumer add one", async () => {
    const user = userEvent.setup();
    render(
      <ComparisonProvider>
        <SelectionProbe />
        <Toggler slug="a" />
      </ComparisonProvider>,
    );

    await waitFor(() => expect(screen.getByText("0 · a-off")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Alternar a" }));
    expect(await screen.findByText("1 · a-on")).toBeInTheDocument();
  });

  it("toggling the same slug twice removes it again", async () => {
    const user = userEvent.setup();
    render(
      <ComparisonProvider>
        <SelectionProbe />
        <Toggler slug="a" />
      </ComparisonProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Alternar a" }));
    await user.click(screen.getByRole("button", { name: "Alternar a" }));

    expect(await screen.findByText("0 · a-off")).toBeInTheDocument();
  });

  it(`caps the selection at ${MAX_COMPARISON_ENTRIES} and ignores a 4th toggle`, async () => {
    const user = userEvent.setup();
    render(
      <ComparisonProvider>
        <SelectionProbe />
        <Toggler slug="a" />
        <Toggler slug="b" />
        <Toggler slug="c" />
        <Toggler slug="d" />
      </ComparisonProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Alternar a" }));
    await user.click(screen.getByRole("button", { name: "Alternar b" }));
    await user.click(screen.getByRole("button", { name: "Alternar c" }));
    await user.click(screen.getByRole("button", { name: "Alternar d" }));

    expect(await screen.findByText(`${MAX_COMPARISON_ENTRIES} · a-on`)).toBeInTheDocument();
  });

  it("remove and clear drop entries directly, without going through toggle", async () => {
    const user = userEvent.setup();
    render(
      <ComparisonProvider>
        <SelectionProbe />
        <Toggler slug="a" />
        <Toggler slug="b" />
        <Remover slug="a" />
        <Clearer />
      </ComparisonProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Alternar a" }));
    await user.click(screen.getByRole("button", { name: "Alternar b" }));
    expect(await screen.findByText("2 · a-on")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Quitar a" }));
    expect(await screen.findByText("1 · a-off")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(await screen.findByText("0 · a-off")).toBeInTheDocument();
  });

  it("persists the selection to sessionStorage and hydrates a later mount from it", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <ComparisonProvider>
        <Toggler slug="a" />
      </ComparisonProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Alternar a" }));
    await waitFor(() => expect(sessionStorage.getItem("bw_comparison_selection")).toContain("\"a\""));
    unmount();

    render(
      <ComparisonProvider>
        <SelectionProbe />
      </ComparisonProvider>,
    );
    expect(await screen.findByText("1 · a-on")).toBeInTheDocument();
  });

  it("discards a corrupted stored value instead of throwing", async () => {
    sessionStorage.setItem("bw_comparison_selection", "{not json");

    render(
      <ComparisonProvider>
        <SelectionProbe />
      </ComparisonProvider>,
    );

    expect(await screen.findByText("0 · a-off")).toBeInTheDocument();
  });

  it("falls back to an empty, unpersisted selection when sessionStorage is inaccessible", async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const user = userEvent.setup();

    render(
      <ComparisonProvider>
        <SelectionProbe />
        <Toggler slug="a" />
      </ComparisonProvider>,
    );
    expect(await screen.findByText("0 · a-off")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Alternar a" }));
    expect(await screen.findByText("1 · a-on")).toBeInTheDocument();

    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
  });

  it("throws in Spanish when used outside the provider", () => {
    function Lonely() {
      useComparison();
      return null;
    }
    // Swallow the expected error boundary console noise for this one assertion.
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Lonely />)).toThrow("useComparison debe usarse dentro de ComparisonProvider.");
    consoleSpy.mockRestore();
  });
});
