import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useWishlistMock, pushMock } = vi.hoisted(() => ({
  useWishlistMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("@/components/storefront/WishlistProvider", () => ({ useWishlist: useWishlistMock }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/bicicletas/producto/mtb-x",
}));

const { SaveButton } = await import("./SaveButton");

describe("SaveButton", () => {
  beforeEach(() => {
    useWishlistMock.mockReset();
    pushMock.mockReset();
  });

  it("shows an unmarked heart and saves on click when signed in", async () => {
    const toggle = vi.fn().mockResolvedValue(undefined);
    useWishlistMock.mockReturnValue({ isSignedIn: true, isSaved: () => false, toggle });

    const user = userEvent.setup();
    render(<SaveButton itemType="bike" itemId="bike-1" />);

    const button = screen.getByRole("button", { name: "Guardar para más tarde" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await user.click(button);

    expect(toggle).toHaveBeenCalledWith("bike", "bike-1");
  });

  it("shows a marked heart and lets the shopper unsave it", () => {
    useWishlistMock.mockReturnValue({ isSignedIn: true, isSaved: () => true, toggle: vi.fn() });

    render(<SaveButton itemType="bike" itemId="bike-1" />);

    expect(screen.getByRole("button", { name: "Quitar de guardados" })).toHaveAttribute("aria-pressed", "true");
  });

  it("navigates to login with a redirect back, without calling toggle, when signed out", async () => {
    const toggle = vi.fn();
    useWishlistMock.mockReturnValue({ isSignedIn: false, isSaved: () => false, toggle });

    const user = userEvent.setup();
    render(<SaveButton itemType="bike" itemId="bike-1" />);

    await user.click(screen.getByRole("button", { name: "Guardar para más tarde" }));

    expect(pushMock).toHaveBeenCalledWith("/ingresar?redirect=%2Fbicicletas%2Fproducto%2Fmtb-x");
    expect(toggle).not.toHaveBeenCalled();
  });
});
