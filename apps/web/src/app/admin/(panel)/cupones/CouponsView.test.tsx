import type { AdminCoupon } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { CouponsView } from "./CouponsView";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function makeCoupon(overrides: Partial<AdminCoupon> = {}): AdminCoupon {
  return {
    id: "coupon-1",
    code: "BUENFIN20",
    name: "Buen Fin 2026",
    type: "percent_off",
    percentOffBps: 2_000,
    scope: { kind: "all" },
    maxRedemptionsPerCustomer: 1,
    redemptionCount: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function stubList(coupons: AdminCoupon[]): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
          status: "success",
          message: "Cupones obtenidos.",
          data: { coupons },
          meta: { total: coupons.length, page: 1, pages: 1, limit: 20 },
        }),
      ),
    ),
  );
}

function renderView() {
  return render(
    <ToastProvider>
      <CouponsView />
    </ToastProvider>,
  );
}

describe("CouponsView", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the empty state when no campaign matches", async () => {
    stubList([]);
    renderView();

    expect(await screen.findByText("No hay cupones con estos filtros")).toBeInTheDocument();
  });

  it("renders a campaign with its code, discount and redemption progress", async () => {
    stubList([makeCoupon({ redemptionCount: 3, maxRedemptionsTotal: 100 })]);
    renderView();

    expect(await screen.findByText("BUENFIN20")).toBeInTheDocument();
    expect(screen.getByText("Buen Fin 2026")).toBeInTheDocument();
    expect(screen.getByText("20%")).toBeInTheDocument();
    expect(screen.getByText("3 / 100")).toBeInTheDocument();
  });

  it("shows a fixed-amount campaign in pesos, not cents", async () => {
    stubList([
      makeCoupon({ type: "amount_off", percentOffBps: undefined, amountOffCents: 50_000, code: "FIJO500" }),
    ]);
    renderView();

    expect(await screen.findByText("$500.00")).toBeInTheDocument();
  });

  it("spells out a percentage ceiling next to the percentage", async () => {
    stubList([makeCoupon({ maxDiscountCents: 500_000 })]);
    renderView();

    expect(await screen.findByText("20% (máx. $5,000.00)")).toBeInTheDocument();
  });

  /**
   * The badge answers "does this work right now?", which is not the same
   * question as `isActive` — a flagged-active campaign can still be expired,
   * not yet started, or fully redeemed.
   */
  it("marks an expired campaign as expired even though it is still flagged active", async () => {
    stubList([makeCoupon({ isActive: true, expiresAt: new Date(Date.now() - 86_400_000).toISOString() })]);
    renderView();

    expect(await screen.findByText("Expirado")).toBeInTheDocument();
  });

  it("marks a campaign that reached its global limit as exhausted", async () => {
    stubList([makeCoupon({ isActive: true, redemptionCount: 50, maxRedemptionsTotal: 50 })]);
    renderView();

    expect(await screen.findByText("Agotado")).toBeInTheDocument();
  });

  it("marks a campaign whose window has not opened as scheduled", async () => {
    stubList([makeCoupon({ isActive: true, startsAt: new Date(Date.now() + 86_400_000).toISOString() })]);
    renderView();

    expect(await screen.findByText("Programado")).toBeInTheDocument();
  });

  it("marks a live campaign as current", async () => {
    stubList([makeCoupon()]);
    renderView();

    expect(await screen.findByText("Vigente")).toBeInTheDocument();
  });

  it("names how many categories a scoped campaign covers", async () => {
    stubList([makeCoupon({ scope: { kind: "categories", itemType: "bike", categoryIds: ["a", "b"] } })]);
    renderView();

    expect(await screen.findByText("2 categorías")).toBeInTheDocument();
  });

  it("warns in the delete dialog that a redeemed campaign should be deactivated instead", async () => {
    stubList([makeCoupon()]);
    renderView();

    await screen.findByText("BUENFIN20");
    await userEvent.click(screen.getAllByRole("button", { name: "Eliminar" })[0]!);

    expect(await screen.findByText(/desactívalo en su lugar/i)).toBeInTheDocument();
  });
});
