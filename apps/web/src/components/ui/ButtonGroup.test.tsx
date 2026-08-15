import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";
import { ButtonGroup } from "./ButtonGroup";

describe("ButtonGroup", () => {
  it("exposes the set as one named group, so the pair reads as a single control", () => {
    render(
      <ButtonGroup label="Reordenar grupo">
        <Button variant="bare" size="icon" aria-label="Subir grupo">
          <svg />
        </Button>
        <Button variant="bare" size="icon" aria-label="Bajar grupo">
          <svg />
        </Button>
      </ButtonGroup>,
    );

    const group = screen.getByRole("group", { name: "Reordenar grupo" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subir grupo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bajar grupo" })).toBeInTheDocument();
  });

  it("draws the only border itself and never clips the children's focus ring", () => {
    render(
      <ButtonGroup label="Cantidad">
        <Button variant="bare" size="icon" aria-label="Restar">
          <svg />
        </Button>
      </ButtonGroup>,
    );

    const group = screen.getByRole("group", { name: "Cantidad" });
    expect(group).toHaveClass("border");
    expect(group).toHaveClass("border-borde");
    // The focus outline sits 2px outside each child; clipping the group would
    // swallow it and leave keyboard users with no visible focus (WCAG AA).
    expect(group).not.toHaveClass("overflow-hidden");
  });

  it("carries a white body and the marker the in-group hover rule keys off", () => {
    render(
      <ButtonGroup label="Cantidad">
        <Button variant="bare" size="icon" aria-label="Restar">
          <svg />
        </Button>
      </ButtonGroup>,
    );

    const group = screen.getByRole("group", { name: "Cantidad" });
    expect(group).toHaveClass("bg-surface");
    // `bare` lifts to white on hover, which is invisible on this white body —
    // `globals.css` presses it to `borde` instead via `.btn-group-solid`.
    expect(group).toHaveClass("btn-group-solid");
    expect(screen.getByRole("button", { name: "Restar" })).toHaveClass("is-bare-neutral");
  });
});
