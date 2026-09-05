import type { PublicSizeGuideEntry } from "@bw-bikes/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SizeSelector, type SizeOption } from "./SizeSelector";

// `SizeGuideModal` is code-split (`next/dynamic`). Warming its chunk once
// here keeps the in-test `findBy` calls waiting on a React re-render, not a
// cold Vite transform racing every other test file's own module loads —
// see `MobileMenu.test.tsx`'s identical warmup for the full reasoning.
beforeAll(async () => {
  await import("./SizeGuideModal");
});

const SIZES: SizeOption[] = [
  { value: "MD", available: true },
  { value: "LG", available: false },
];

const SIZE_GUIDE: PublicSizeGuideEntry[] = [{ value: "MD", minHeightCm: 170, maxHeightCm: 180 }];

describe("SizeSelector", () => {
  it("renders nothing when there are no sizes", () => {
    const { container } = render(<SizeSelector sizes={[]} selected={undefined} onSelect={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders one radio per size, disabling the unavailable one", () => {
    render(<SizeSelector sizes={SIZES} selected={undefined} onSelect={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "MD" })).toBeEnabled();
    expect(screen.getByRole("radio", { name: "LG" })).toBeDisabled();
  });

  it("marks the selected size checked", () => {
    render(<SizeSelector sizes={SIZES} selected="MD" onSelect={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "MD" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "LG" })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onSelect for an available size but not for a disabled one", () => {
    const onSelect = vi.fn();
    render(<SizeSelector sizes={SIZES} selected={undefined} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("radio", { name: "MD" }));
    expect(onSelect).toHaveBeenCalledWith("MD");

    fireEvent.click(screen.getByRole("radio", { name: "LG" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("doesn't render the size-guide links when there's no guide data", () => {
    render(<SizeSelector sizes={SIZES} selected={undefined} onSelect={vi.fn()} sizeGuide={[]} />);
    expect(screen.queryByRole("button", { name: "¿Cuál es mi talla?" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guía de tallas" })).not.toBeInTheDocument();
  });

  it("opens the guide modal on the finder tab from the first link, and on the guide tab from the second", async () => {
    render(<SizeSelector sizes={SIZES} selected={undefined} onSelect={vi.fn()} sizeGuide={SIZE_GUIDE} />);

    // `SizeGuideModal` is code-split (`next/dynamic`, M-optimización) and
    // only mounts once one of these links is clicked — `findBy` waits for it.
    fireEvent.click(screen.getByRole("button", { name: "Guía de tallas" }));
    expect(await screen.findByRole("tab", { name: "Guía de tallas" }, { timeout: 3000 })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("button", { name: "¿Cuál es mi talla?" }));
    expect(screen.getByRole("tab", { name: "¿Cuál es mi talla?" })).toHaveAttribute("aria-selected", "true");
  });

  it("selecting a size from the guide's result step calls this component's own onSelect", async () => {
    const onSelect = vi.fn();
    render(<SizeSelector sizes={SIZES} selected={undefined} onSelect={onSelect} sizeGuide={SIZE_GUIDE} />);

    fireEvent.click(screen.getByRole("button", { name: "¿Cuál es mi talla?" }));
    await screen.findByRole("tab", { name: "¿Cuál es mi talla?" }, { timeout: 3000 });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Seleccionar talla" }));

    expect(onSelect).toHaveBeenCalledWith("MD");
  });
});
