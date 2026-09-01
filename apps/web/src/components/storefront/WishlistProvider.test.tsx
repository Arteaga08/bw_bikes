import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAccountWishlistMock, addAccountWishlistItemMock, removeAccountWishlistItemMock } = vi.hoisted(() => ({
  getAccountWishlistMock: vi.fn(),
  addAccountWishlistItemMock: vi.fn(),
  removeAccountWishlistItemMock: vi.fn(),
}));

vi.mock("@/lib/api/account", () => ({
  getAccountWishlist: getAccountWishlistMock,
  addAccountWishlistItem: addAccountWishlistItemMock,
  removeAccountWishlistItem: removeAccountWishlistItemMock,
}));

const { WishlistProvider, useWishlist } = await import("./WishlistProvider");

function SavedProbe({ label }: { label: string }) {
  const { isSaved } = useWishlist();
  return <span>{label}: {isSaved("bike", "bike-1") ? "saved" : "unsaved"}</span>;
}

function Toggler() {
  const { toggle } = useWishlist();
  return (
    <button type="button" onClick={() => void toggle("bike", "bike-1")}>
      Guardar
    </button>
  );
}

describe("WishlistProvider", () => {
  beforeEach(() => {
    getAccountWishlistMock.mockReset();
    addAccountWishlistItemMock.mockReset();
    removeAccountWishlistItemMock.mockReset();
  });

  it("hydrates the saved-product ids from a single GET /account/wishlist", async () => {
    getAccountWishlistMock.mockResolvedValue([
      { itemType: "bike", itemId: "bike-1", addedAt: "2026-01-01T00:00:00.000Z", isAvailable: true },
    ]);

    render(
      <WishlistProvider>
        <SavedProbe label="a" />
      </WishlistProvider>,
    );

    await waitFor(() => expect(screen.getByText("a: saved")).toBeInTheDocument());
    expect(getAccountWishlistMock).toHaveBeenCalledTimes(1);
  });

  it("a toggle from one consumer is reflected by another without a second fetch", async () => {
    getAccountWishlistMock.mockResolvedValue([]);
    addAccountWishlistItemMock.mockResolvedValue([]);
    const user = userEvent.setup();

    render(
      <WishlistProvider>
        <SavedProbe label="a" />
        <SavedProbe label="b" />
        <Toggler />
      </WishlistProvider>,
    );

    await waitFor(() => expect(screen.getByText("a: unsaved")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(screen.getByText("a: saved")).toBeInTheDocument());
    expect(screen.getByText("b: saved")).toBeInTheDocument();
    expect(addAccountWishlistItemMock).toHaveBeenCalledWith({ itemType: "bike", itemId: "bike-1" });
    expect(getAccountWishlistMock).toHaveBeenCalledTimes(1);
  });

  it("treats a 401 on hydration as signed out, not an error", async () => {
    const { ApiError } = await import("@/lib/api/error");
    getAccountWishlistMock.mockRejectedValue(new ApiError("No autenticado.", 401));

    function SignedInProbe() {
      const { isSignedIn } = useWishlist();
      return <span>{isSignedIn === false ? "signed-out" : "unknown"}</span>;
    }

    render(
      <WishlistProvider>
        <SignedInProbe />
      </WishlistProvider>,
    );

    await waitFor(() => expect(screen.getByText("signed-out")).toBeInTheDocument());
  });
});
