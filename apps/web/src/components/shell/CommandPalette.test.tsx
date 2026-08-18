import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useRouterMock } = vi.hoisted(() => ({ useRouterMock: vi.fn(() => ({ push: vi.fn() })) }));
vi.mock("next/navigation", () => ({ useRouter: useRouterMock }));

const { CommandPalette } = await import("./CommandPalette");

describe("CommandPalette", () => {
  it("hides Auditoría from an admin — the API's restrictTo is the real barrier, this is cosmetic", () => {
    render(<CommandPalette open onClose={() => {}} role="admin" />);
    expect(screen.queryByRole("option", { name: /Auditoría/ })).not.toBeInTheDocument();
  });

  it("shows Auditoría to a superadmin", () => {
    render(<CommandPalette open onClose={() => {}} role="superadmin" />);
    expect(screen.getByRole("option", { name: /Auditoría/ })).toBeInTheDocument();
  });

  it("still finds Auditoría by its keywords when searching, for a superadmin", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<CommandPalette open onClose={() => {}} role="superadmin" />);

    await user.type(screen.getByLabelText("Buscar sección"), "bitacora");

    expect(screen.getByRole("option", { name: /Auditoría/ })).toBeInTheDocument();
  });
});
