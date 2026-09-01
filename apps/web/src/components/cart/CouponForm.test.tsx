import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/error";

const { useCartMock } = vi.hoisted(() => ({ useCartMock: vi.fn() }));
vi.mock("./CartProvider", () => ({ useCart: useCartMock }));

const { CouponForm } = await import("./CouponForm");

describe("CouponForm", () => {
  it("applies a code typed into the input", async () => {
    const applyCoupon = vi.fn().mockResolvedValue(undefined);
    useCartMock.mockReturnValue({ applyCoupon, removeCoupon: vi.fn() });
    const user = userEvent.setup();
    render(<CouponForm />);

    await user.type(screen.getByPlaceholderText("Código de cupón"), "VERANO10");
    await user.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(applyCoupon).toHaveBeenCalledWith("VERANO10");
  });

  it("shows the backend's error message inline, including a 429", async () => {
    const applyCoupon = vi.fn().mockRejectedValue(new ApiError("Demasiados intentos con cupones. Espera unos minutos e intenta de nuevo.", 429));
    useCartMock.mockReturnValue({ applyCoupon, removeCoupon: vi.fn() });
    const user = userEvent.setup();
    render(<CouponForm />);

    await user.type(screen.getByPlaceholderText("Código de cupón"), "X");
    await user.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(await screen.findByText("Demasiados intentos con cupones. Espera unos minutos e intenta de nuevo.")).toBeInTheDocument();
  });

  it("shows the applied code and a 'Quitar' action instead of the form", async () => {
    const removeCoupon = vi.fn().mockResolvedValue(undefined);
    useCartMock.mockReturnValue({ applyCoupon: vi.fn(), removeCoupon });
    const user = userEvent.setup();
    render(<CouponForm coupon={{ couponId: "coupon-1", code: "VERANO10", type: "percent_off", discountCents: 5000 }} />);

    expect(screen.getByText("VERANO10")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitar" }));
    expect(removeCoupon).toHaveBeenCalled();
  });
});
