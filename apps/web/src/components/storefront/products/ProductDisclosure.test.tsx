import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProductDisclosure } from "./ProductDisclosure";

function setHash(hash: string) {
  window.location.hash = hash;
}

describe("ProductDisclosure", () => {
  afterEach(() => {
    setHash("");
  });

  it("starts collapsed, with the panel inert", () => {
    render(
      <ProductDisclosure title="Especificaciones técnicas">
        <p>Contenido</p>
      </ProductDisclosure>,
    );

    expect(screen.getByRole("button", { name: "Especificaciones técnicas" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByText("Contenido").closest("[inert]")).not.toBeNull();
  });

  it("toggles expanded state on click, removing inert once open", () => {
    render(
      <ProductDisclosure title="Geometría">
        <p>Contenido</p>
      </ProductDisclosure>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Geometría" }));

    expect(screen.getByRole("button", { name: "Geometría" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Contenido").closest("[inert]")).toBeNull();
  });

  it("starts expanded when the URL already carries the matching hash", () => {
    setHash("#especificaciones");

    render(
      <ProductDisclosure title="Especificaciones técnicas" openOnHash="especificaciones">
        <p>Contenido</p>
      </ProductDisclosure>,
    );

    expect(screen.getByRole("button", { name: "Especificaciones técnicas" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("opens on a hashchange to the matching hash, e.g. a click on the summary link", () => {
    render(
      <ProductDisclosure title="Especificaciones técnicas" openOnHash="especificaciones">
        <p>Contenido</p>
      </ProductDisclosure>,
    );

    expect(screen.getByRole("button", { name: "Especificaciones técnicas" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    setHash("#especificaciones");
    fireEvent(window, new Event("hashchange"));

    expect(screen.getByRole("button", { name: "Especificaciones técnicas" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("ignores a hashchange to an unrelated hash", () => {
    render(
      <ProductDisclosure title="Geometría" openOnHash="especificaciones">
        <p>Contenido</p>
      </ProductDisclosure>,
    );

    setHash("#otra-cosa");
    fireEvent(window, new Event("hashchange"));

    expect(screen.getByRole("button", { name: "Geometría" })).toHaveAttribute("aria-expanded", "false");
  });
});
