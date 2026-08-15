import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "./use-debounced-value";

/** Renders the live value and its debounced counterpart side by side so a test can compare them. */
function Harness({ value, delayMs }: { value: string; delayMs: number }) {
  const debounced = useDebouncedValue(value, delayMs);
  return (
    <>
      <span data-testid="live">{value}</span>
      <span data-testid="debounced">{debounced}</span>
    </>
  );
}

/** `vi.advanceTimersByTimeAsync` fires the timer callback, but only `act` flushes the resulting `setState` into the DOM. */
async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not update before the delay elapses", async () => {
    const { rerender } = render(<Harness value="" delayMs={300} />);
    rerender(<Harness value="b" delayMs={300} />);

    expect(screen.getByTestId("debounced")).toHaveTextContent("");

    await advance(299);
    expect(screen.getByTestId("debounced")).toHaveTextContent("");
  });

  it("updates once the delay has fully elapsed", async () => {
    const { rerender } = render(<Harness value="" delayMs={300} />);
    rerender(<Harness value="b" delayMs={300} />);

    await advance(300);
    expect(screen.getByTestId("debounced")).toHaveTextContent("b");
  });

  it("collapses several fast changes into a single update, matching the last value", async () => {
    const { rerender } = render(<Harness value="" delayMs={300} />);
    rerender(<Harness value="b" delayMs={300} />);
    await advance(100);
    rerender(<Harness value="be" delayMs={300} />);
    await advance(100);
    rerender(<Harness value="bes" delayMs={300} />);

    // Only 200ms have elapsed since the last change — still pending.
    await advance(200);
    expect(screen.getByTestId("debounced")).toHaveTextContent("");

    await advance(100);
    expect(screen.getByTestId("debounced")).toHaveTextContent("bes");
  });

  it("never delays the live value shown to the user, only what's read from the debounced one", () => {
    const { rerender } = render(<Harness value="" delayMs={300} />);
    rerender(<Harness value="x" delayMs={300} />);

    expect(screen.getByTestId("live")).toHaveTextContent("x");
    expect(screen.getByTestId("debounced")).toHaveTextContent("");
  });
});
