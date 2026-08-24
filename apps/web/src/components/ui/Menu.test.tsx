import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Menu } from "./Menu";

describe("Menu", () => {
  it("opens the default kebab trigger and fires an item's onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Menu ariaLabel="Más acciones" items={[{ label: "Agregar subcategoría", onClick }]} />);

    await user.click(screen.getByRole("button", { name: "Más acciones" }));
    await user.click(screen.getByRole("menuitem", { name: "Agregar subcategoría" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders a custom trigger instead of the default kebab when `trigger` is passed", () => {
    render(
      <Menu
        ariaLabel="Cuenta"
        trigger={<span data-testid="avatar">MA</span>}
        items={[{ label: "Cerrar sesión", onClick: vi.fn() }]}
      />,
    );

    expect(screen.getByTestId("avatar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cuenta" })).toBeInTheDocument();
  });

  it("renders `header` content above the item list when the menu is open", async () => {
    const user = userEvent.setup();
    render(
      <Menu
        ariaLabel="Cuenta"
        header={<p>admin@bnwbikes.com</p>}
        items={[{ label: "Cerrar sesión", onClick: vi.fn() }]}
      />,
    );

    expect(screen.queryByText("admin@bnwbikes.com")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cuenta" }));

    expect(screen.getByText("admin@bnwbikes.com")).toBeInTheDocument();
  });

  it("still closes on Escape when using a custom trigger and header", async () => {
    const user = userEvent.setup();
    render(
      <Menu
        ariaLabel="Cuenta"
        trigger={<span>MA</span>}
        header={<p>admin@bnwbikes.com</p>}
        items={[{ label: "Cerrar sesión", onClick: vi.fn() }]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cuenta" }));
    expect(screen.getByRole("menuitem", { name: "Cerrar sesión" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menuitem", { name: "Cerrar sesión" })).not.toBeInTheDocument();
  });
});
