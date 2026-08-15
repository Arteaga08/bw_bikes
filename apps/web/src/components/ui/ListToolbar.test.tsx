import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ListToolbar } from "./ListToolbar";

describe("ListToolbar", () => {
  it("stays fixed to the top of its scroll container with an opaque ground behind it", () => {
    const { container } = render(<ListToolbar searchLabel="Buscar" value="" onChange={() => {}} />);

    expect(container.firstElementChild).toHaveClass("sticky", "top-0", "bg-base");
  });

  it("propagates every keystroke to onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ListToolbar searchLabel="Buscar" value="" onChange={onChange} />);

    await user.type(screen.getByLabelText("Buscar"), "novedad");
    expect(onChange).toHaveBeenCalledTimes("novedad".length);
    expect(onChange).toHaveBeenLastCalledWith("d");
  });

  it("mirrors the primary action as an icon button that only shows below `sm`, and fires the same handler", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ListToolbar searchLabel="Buscar" value="" onChange={() => {}} action={{ label: "Nuevo badge", onClick }} />);

    const button = screen.getByRole("button", { name: "Nuevo badge" });
    expect(button).toHaveClass("sm:hidden");

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("omits the action button when no action is given", () => {
    render(<ListToolbar searchLabel="Buscar" value="" onChange={() => {}} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("announces the result count politely, and omits it entirely when absent", () => {
    const { rerender } = render(<ListToolbar searchLabel="Buscar" value="" onChange={() => {}} count="2 badges" />);
    expect(screen.getByText("2 badges")).toHaveAttribute("aria-live", "polite");

    rerender(<ListToolbar searchLabel="Buscar" value="" onChange={() => {}} />);
    expect(screen.queryByText("2 badges")).not.toBeInTheDocument();
  });
});
