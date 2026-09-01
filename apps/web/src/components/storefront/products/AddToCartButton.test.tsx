import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/error";

const { useCartMock, pushMock, replaceMock, searchParamsMock } = vi.hoisted(() => ({
  useCartMock: vi.fn(),
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
  searchParamsMock: vi.fn(() => new URLSearchParams()),
}));

vi.mock("@/components/cart/CartProvider", () => ({ useCart: useCartMock }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  usePathname: () => "/bicicletas/producto/mtb-x",
  useSearchParams: searchParamsMock,
}));

const { AddToCartButton } = await import("./AddToCartButton");

describe("AddToCartButton", () => {
  it("shows 'Selecciona una talla' disabled when no sku is selected", () => {
    useCartMock.mockReturnValue({ addLine: vi.fn(), openDrawer: vi.fn() });
    render(<AddToCartButton itemType="bike" itemId="bike-1" isSoldOut={false} productName="Bici X" />);

    expect(screen.getByRole("button", { name: "Selecciona una talla" })).toBeDisabled();
  });

  it("shows 'Agotado' disabled when the variant is sold out", () => {
    useCartMock.mockReturnValue({ addLine: vi.fn(), openDrawer: vi.fn() });
    render(<AddToCartButton itemType="bike" itemId="bike-1" sku="SKU-1" isSoldOut productName="Bici X" />);

    expect(screen.getByRole("button", { name: "Agotado" })).toBeDisabled();
  });

  it("adds the line, opens the drawer, and shows the success label on click", async () => {
    const addLine = vi.fn().mockResolvedValue(undefined);
    const openDrawer = vi.fn();
    useCartMock.mockReturnValue({ addLine, openDrawer });
    const user = userEvent.setup();
    render(<AddToCartButton itemType="bike" itemId="bike-1" sku="SKU-1" isSoldOut={false} productName="Bici X" />);

    await user.click(screen.getByRole("button", { name: /Agregar al carrito/ }));

    await waitFor(() => expect(addLine).toHaveBeenCalledWith("bike", "bike-1", "SKU-1", 1));
    expect(openDrawer).toHaveBeenCalled();
    expect(await screen.findByText("Agregado")).toBeInTheDocument();
  });

  it("a fast double click only fires one add", async () => {
    const addLine = vi.fn().mockResolvedValue(undefined);
    useCartMock.mockReturnValue({ addLine, openDrawer: vi.fn() });
    const user = userEvent.setup();
    render(<AddToCartButton itemType="bike" itemId="bike-1" sku="SKU-1" isSoldOut={false} productName="Bici X" />);

    const button = screen.getByRole("button", { name: /Agregar al carrito/ });
    await user.click(button);
    await user.click(button);

    expect(addLine).toHaveBeenCalledTimes(1);
  });

  it("navigates to /ingresar with a redirect on a 401", async () => {
    const addLine = vi.fn().mockRejectedValue(new ApiError("No autenticado.", 401));
    useCartMock.mockReturnValue({ addLine, openDrawer: vi.fn() });
    const user = userEvent.setup();
    render(<AddToCartButton itemType="bike" itemId="bike-1" sku="SKU-1" isSoldOut={false} productName="Bici X" />);

    await user.click(screen.getByRole("button", { name: /Agregar al carrito/ }));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/ingresar?redirect=%2Fbicicletas%2Fproducto%2Fmtb-x%3Fsku%3DSKU-1%26agregar%3D1"),
    );
  });

  it("fires the add exactly once on a return from login with a matching ?sku", async () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("sku=SKU-1&agregar=1"));
    const addLine = vi.fn().mockResolvedValue(undefined);
    useCartMock.mockReturnValue({ addLine, openDrawer: vi.fn() });
    render(<AddToCartButton itemType="bike" itemId="bike-1" sku="SKU-1" isSoldOut={false} productName="Bici X" />);

    await waitFor(() => expect(addLine).toHaveBeenCalledTimes(1));
    expect(replaceMock).toHaveBeenCalledWith("/bicicletas/producto/mtb-x");

    searchParamsMock.mockReturnValue(new URLSearchParams());
  });
});
