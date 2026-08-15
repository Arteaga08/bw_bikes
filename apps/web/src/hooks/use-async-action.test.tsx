import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/Button";
import { useAsyncAction } from "./use-async-action";

/** Deferred promise so a test can hold the action open and click again mid-flight. */
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function Harness({ action, successMs }: { action: () => Promise<void>; successMs?: number }) {
  const add = useAsyncAction(action, successMs === undefined ? {} : { successMs });
  return (
    <Button onClick={add.run} loading={add.pending} success={add.succeeded} successLabel="Agregado">
      Agregar al carrito
    </Button>
  );
}

describe("useAsyncAction", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs the action once per click", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const action = vi.fn(async () => {});
    render(<Harness action={action} successMs={10} />);

    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  });

  it("ignores a second click while the first is still in flight", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const gate = deferred();
    const action = vi.fn(() => gate.promise);
    render(<Harness action={action} />);

    const button = screen.getByRole("button");
    await user.click(button);
    await waitFor(() => expect(button).toBeDisabled());

    // Fire straight at the element: a real double click can land before React
    // has committed the disabled attribute, which is what the ref guards.
    button.click();
    button.click();
    expect(action).toHaveBeenCalledTimes(1);

    gate.resolve();
  });

  it("keeps blocking through the confirmation window, then unlocks", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const action = vi.fn(async () => {});
    render(<Harness action={action} successMs={2000} />);

    const button = screen.getByRole("button");
    await user.click(button);

    // Confirmed: label swapped, still not clickable.
    await waitFor(() => expect(screen.getByRole("button", { name: "Agregado" })).toBeDisabled());
    screen.getByRole("button").click();
    expect(action).toHaveBeenCalledTimes(1);

    // Window closes: back to the original label and clickable again.
    await vi.advanceTimersByTimeAsync(2000);
    await waitFor(() => expect(screen.getByRole("button", { name: "Agregar al carrito" })).toBeEnabled());

    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
  });

  it("unlocks immediately when the action fails, so the user can retry", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const action = vi.fn(async () => {
      throw new Error("sin stock");
    });
    render(<Harness action={action} />);

    await user.click(screen.getByRole("button"));

    // No confirmation state on failure — the label never changes.
    await waitFor(() => expect(screen.getByRole("button", { name: "Agregar al carrito" })).toBeEnabled());
    expect(screen.queryByRole("button", { name: "Agregado" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
  });
});
