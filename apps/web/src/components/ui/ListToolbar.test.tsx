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

  it("announces the result count politely, and omits it entirely when absent", () => {
    const { rerender } = render(<ListToolbar searchLabel="Buscar" value="" onChange={() => {}} count="2 badges" />);
    expect(screen.getByText("2 badges")).toHaveAttribute("aria-live", "polite");

    rerender(<ListToolbar searchLabel="Buscar" value="" onChange={() => {}} />);
    expect(screen.queryByText("2 badges")).not.toBeInTheDocument();
  });
});
