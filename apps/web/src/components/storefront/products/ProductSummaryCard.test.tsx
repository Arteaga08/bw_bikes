import type { SummaryRow } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductSummaryCard } from "./ProductSummaryCard";

function row(label: string, value: string, order: number): SummaryRow {
  return { label, value, order };
}

/** Los pares `label`/`value` en el orden en que quedaron pintados. */
function renderedRows(container: HTMLElement): Array<[string, string]> {
  return Array.from(container.querySelectorAll("dl > div")).map((entry) => [
    entry.querySelector("dt")?.textContent ?? "",
    entry.querySelector("dd")?.textContent ?? "",
  ]);
}

describe("ProductSummaryCard", () => {
  it("renders the rows by `order`, not by array position", () => {
    const { container } = render(
      <ProductSummaryCard
        rows={[row("Peso", "7.1 kg", 2), row("Uso", "Ruta", 0), row("Cuadro", "Carbono", 1)]}
        hasSpecSheet
      />,
    );

    expect(renderedRows(container)).toEqual([
      ["Uso", "Ruta"],
      ["Cuadro", "Carbono"],
      ["Peso", "7.1 kg"],
    ]);
  });

  it("drops half-filled rows instead of painting them empty", () => {
    const { container } = render(
      <ProductSummaryCard rows={[row("Uso", "Ruta", 0), row("Ruedas", "   ", 1), row("   ", "SRAM", 2)]} hasSpecSheet />,
    );

    expect(renderedRows(container)).toEqual([["Uso", "Ruta"]]);
  });

  it("links to the full technical sheet when there is one", () => {
    render(<ProductSummaryCard rows={[row("Uso", "Ruta", 0)]} hasSpecSheet />);

    expect(screen.getByRole("heading", { name: "En pocas palabras" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver todas las especificaciones/ })).toHaveAttribute(
      "href",
      "#especificaciones",
    );
  });

  it("omits the link when there is no spec sheet to send it to — otherwise it's the same broken anchor with a different cause", () => {
    render(<ProductSummaryCard rows={[row("Uso", "Ruta", 0)]} hasSpecSheet={false} />);

    expect(screen.queryByRole("link", { name: /Ver todas las especificaciones/ })).not.toBeInTheDocument();
  });

  it("signs the card with the gold rhino, once, next to the heading", () => {
    const { container } = render(<ProductSummaryCard rows={[row("Uso", "Ruta", 0), row("Peso", "9 kg", 1)]} hasSpecSheet />);

    expect(container.querySelectorAll('img[src="/brand/rhino-dorado.svg"]')).toHaveLength(1);
  });

  it("separates the rows by space, not by a hairline under every one", () => {
    // Dos reglas horizontales en total y ninguna por renglón: la del encabezado
    // y la del enlace. Ver el comentario del componente.
    const { container } = render(
      <ProductSummaryCard rows={[row("Uso", "Ruta", 0), row("Peso", "9 kg", 1), row("Motor", "Bosch", 2)]} hasSpecSheet />,
    );

    expect(container.querySelectorAll("dl > div.border-b")).toHaveLength(0);
  });

  it("renders nothing when there's no summary — an accessory has no overview block", () => {
    const { container } = render(<ProductSummaryCard rows={[]} hasSpecSheet />);

    expect(container).toBeEmptyDOMElement();
  });
});
