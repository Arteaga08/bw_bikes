import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { usePathnameMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: usePathnameMock }));

const { AccountBackLink } = await import("./AccountBackLink");

describe("AccountBackLink", () => {
  it("renders nothing on the account hub itself", () => {
    usePathnameMock.mockReturnValue("/mi-cuenta");
    const { container } = render(<AccountBackLink />);

    expect(container).toBeEmptyDOMElement();
  });

  it("links back to the hub from a sub-page", () => {
    usePathnameMock.mockReturnValue("/mi-cuenta/pedidos");
    render(<AccountBackLink />);

    expect(screen.getByRole("link", { name: /Mi Cuenta/ })).toHaveAttribute("href", "/mi-cuenta");
  });
});
