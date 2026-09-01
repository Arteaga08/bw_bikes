import { User } from "@phosphor-icons/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountTile } from "./AccountTile";

describe("AccountTile", () => {
  it("renders a link to the given href with the label as its accessible name", () => {
    render(<AccountTile href="/mi-cuenta/perfil" label="Perfil" icon={User} />);

    const link = screen.getByRole("link", { name: "Perfil" });
    expect(link).toHaveAttribute("href", "/mi-cuenta/perfil");
  });

  it("hides the icon from assistive tech", () => {
    const { container } = render(<AccountTile href="/mi-cuenta/perfil" label="Perfil" icon={User} />);

    const icon = container.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});
