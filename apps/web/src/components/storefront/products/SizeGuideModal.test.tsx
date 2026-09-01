import type { PublicSizeGuideEntry } from "@bw-bikes/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SizeGuideModal } from "./SizeGuideModal";
import type { SizeOption } from "./SizeSelector";

// S and M overlap at height 170 (S: 160-172, M: 170-180) — "balanced" picks S
// (midpoint 166, distance 4) over M (midpoint 175, distance 5) at the
// component's default 170cm starting height.
const GUIDE: PublicSizeGuideEntry[] = [
  { value: "S", minHeightCm: 160, maxHeightCm: 172 },
  { value: "M", minHeightCm: 170, maxHeightCm: 180 },
  { value: "L", minHeightCm: 178, maxHeightCm: 190 },
];

const SIZE_OPTIONS: SizeOption[] = [
  { value: "S", available: true },
  { value: "M", available: false },
  { value: "L", available: true },
];

function renderModal(overrides: Partial<Parameters<typeof SizeGuideModal>[0]> = {}) {
  const onClose = vi.fn();
  const onSelectSize = vi.fn();
  const onTabChange = vi.fn();
  render(
    <SizeGuideModal
      open
      tab="finder"
      onTabChange={onTabChange}
      sizeGuide={GUIDE}
      sizeOptions={SIZE_OPTIONS}
      onClose={onClose}
      onSelectSize={onSelectSize}
      {...overrides}
    />,
  );
  return { onClose, onSelectSize, onTabChange };
}

describe("SizeGuideModal", () => {
  it("switches tabs by calling onTabChange, not by managing its own tab state", () => {
    const { onTabChange } = renderModal({ tab: "finder" });
    fireEvent.click(screen.getByRole("tab", { name: "Guía de tallas" }));
    expect(onTabChange).toHaveBeenCalledWith("guide");
  });

  it("guide tab lists every size with its height range and availability", () => {
    renderModal({ tab: "guide" });

    const rows = screen.getAllByRole("row").slice(1); // drop the header row
    expect(rows).toHaveLength(3);
    expect(screen.getByText("160–172 cm")).toBeInTheDocument();
    expect(screen.getByText("170–180 cm")).toBeInTheDocument();
    expect(screen.getByText("178–190 cm")).toBeInTheDocument();
    // "M" is in the guide but unavailable per `sizeOptions`.
    const mRow = screen.getByText("M").closest("tr")!;
    expect(mRow).toHaveTextContent("Agotada");
  });

  it("guide tab shows an empty message instead of a table when there's no data", () => {
    renderModal({ tab: "guide", sizeGuide: [] });
    expect(screen.getByText(/todavía no hay una guía de tallas/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("finder tab starts on step 1 (height) and walks forward through the 3-step wizard", () => {
    renderModal({ tab: "finder" });

    expect(screen.getByText("Paso 1 de 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Tu estatura")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Paso 2 de 3")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "¿Cómo prefieres rodar?" })).toBeInTheDocument();
    // "Equilibrado" (balanced) is the default style.
    expect(screen.getByRole("radio", { name: /Equilibrado/ })).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Paso 3 de 3")).toBeInTheDocument();
    // Default height (170cm) + balanced style resolves to "S" per this fixture.
    expect(screen.getByText("Talla recomendada").nextElementSibling).toHaveTextContent("S");
  });

  it("result step offers both overlapping sizes as chips, defaulting to the recommended one", () => {
    renderModal({ tab: "finder" });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(screen.getByRole("radio", { name: "S" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "M" })).toHaveAttribute("aria-checked", "false");
  });

  it("confirming the result calls onSelectSize with the chosen size and closes the modal", () => {
    const { onSelectSize, onClose } = renderModal({ tab: "finder" });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    fireEvent.click(screen.getByRole("button", { name: "Seleccionar talla" }));
    expect(onSelectSize).toHaveBeenCalledWith("S");
    expect(onClose).toHaveBeenCalled();
  });

  it("switching the result chip to the unavailable alternative surfaces a warning", () => {
    renderModal({ tab: "finder" });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    fireEvent.click(screen.getByRole("radio", { name: "M" }));
    expect(screen.getByText(/agotada en este color/i)).toBeInTheDocument();
  });

  it("finder tab shows an empty message instead of the wizard when there's no data", () => {
    renderModal({ tab: "finder", sizeGuide: [] });
    expect(screen.getByText(/todavía no tenemos suficientes datos/i)).toBeInTheDocument();
    expect(screen.queryByText("Paso 1 de 3")).not.toBeInTheDocument();
  });

  it("clicking the overlay scrim calls onClose", () => {
    const { onClose } = renderModal();
    // The scrim is the first `aria-hidden` sibling — findable by its click handler role via testId-free query.
    fireEvent.click(document.querySelector('[aria-hidden="true"].fixed.inset-0')!);
    expect(onClose).toHaveBeenCalled();
  });
});
