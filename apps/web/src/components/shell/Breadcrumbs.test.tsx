import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { usePathnameMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: usePathnameMock }));

const { Breadcrumbs } = await import("./Breadcrumbs");

describe("Breadcrumbs", () => {
  it("renders nothing at the root", () => {
    usePathnameMock.mockReturnValue("/");
    const { container } = render(<Breadcrumbs />);
    expect(container).toBeEmptyDOMElement();
  });

  it("derives labels from the path segments; the last item is text, the rest are links", () => {
    usePathnameMock.mockReturnValue("/admin/ordenes");
    render(<Breadcrumbs />);

    const inicioLink = screen.getByRole("link", { name: "Inicio" });
    expect(inicioLink).toHaveAttribute("href", "/admin");

    const last = screen.getByText("Órdenes");
    expect(last.tagName).toBe("SPAN");
    expect(screen.queryByRole("link", { name: "Órdenes" })).not.toBeInTheDocument();
  });
});
