import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useVariantAvailability } from "./use-variant-availability";

const { fetchVariantAvailabilityMock } = vi.hoisted(() => ({ fetchVariantAvailabilityMock: vi.fn() }));
vi.mock("@/lib/api/catalog-availability", () => ({ fetchVariantAvailability: fetchVariantAvailabilityMock }));

function Harness({ sku }: { sku: string }) {
  const { status, isSoldOut } = useVariantAvailability("bike", ["item-1"]);
  return (
    <p>
      {status}:{isSoldOut(sku) ? "agotado" : "disponible"}
    </p>
  );
}

describe("useVariantAvailability", () => {
  it("reports a SKU as not sold out while the request is loading", () => {
    fetchVariantAvailabilityMock.mockReturnValue(new Promise(() => {}));
    render(<Harness sku="SKU-1" />);

    expect(screen.getByText("loading:disponible")).toBeInTheDocument();
  });

  it("reads the resolved map once it lands", async () => {
    fetchVariantAvailabilityMock.mockResolvedValue(new Map([["SKU-1", false]]));
    render(<Harness sku="SKU-1" />);

    await waitFor(() => expect(screen.getByText("ready:agotado")).toBeInTheDocument());
  });

  it("fails open — a network error still reads as not sold out", async () => {
    fetchVariantAvailabilityMock.mockRejectedValue(new Error("network"));
    render(<Harness sku="SKU-1" />);

    await waitFor(() => expect(screen.getByText("error:disponible")).toBeInTheDocument());
  });
});
