import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductDescriptionTeaser } from "./ProductDescriptionTeaser";

describe("ProductDescriptionTeaser", () => {
  it("shows the short teaser, with a 'Leer más' link, when it differs from the full description", () => {
    render(
      <ProductDescriptionTeaser
        shortDescription="Híbrida eléctrica con motor de asistencia."
        description="Motor Bosch de asistencia al pedaleo y batería integrada en el cuadro para hasta 80km de autonomía."
      />,
    );

    expect(screen.getByText("Híbrida eléctrica con motor de asistencia.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Leer más" })).toHaveAttribute("href", "#descripcion");
  });

  it("never renders the full description in the rail — that text lives in the section below", () => {
    render(
      <ProductDescriptionTeaser
        shortDescription="Híbrida eléctrica con motor de asistencia."
        description="Motor Bosch de asistencia al pedaleo y batería integrada en el cuadro para hasta 80km de autonomía."
      />,
    );

    expect(screen.queryByText(/Motor Bosch/)).not.toBeInTheDocument();
  });

  it("shows only the description, with no link, when there's no shortDescription and jsdom reports no clamp truncation", () => {
    // Accessories have no `shortDescription` (`accessory.model.ts`). jsdom never
    // computes real layout, so `scrollHeight`/`clientHeight` both read 0 and the
    // clamp-truncation check can't fire here — this exercises that default,
    // not real overflow, which needs a live browser to observe.
    render(<ProductDescriptionTeaser description="Cámara de repuesto estándar." />);

    expect(screen.getByText("Cámara de repuesto estándar.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
