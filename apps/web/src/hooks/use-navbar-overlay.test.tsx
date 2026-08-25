import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { usePathnameMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn(() => "/") }));
vi.mock("next/navigation", () => ({ usePathname: usePathnameMock }));

const { useNavbarOverlay } = await import("./use-navbar-overlay");

/** Captures the callback so a test can trigger it by hand — the shared jsdom stub in `vitest.setup.ts` can't, it's a real no-op. */
class FakeIntersectionObserver implements IntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly root = null;
  readonly rootMargin: string;
  readonly thresholds: readonly number[] = [];
  callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.rootMargin = options?.rootMargin ?? "";
    FakeIntersectionObserver.instances.push(this);
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  trigger(isIntersecting: boolean): void {
    act(() => {
      this.callback([{ isIntersecting } as IntersectionObserverEntry], this);
    });
  }
}

function TestConsumer() {
  const overlay = useNavbarOverlay();
  return <div data-testid="result">{String(overlay)}</div>;
}

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  usePathnameMock.mockReturnValue("/");
  window.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
  document.body.innerHTML = "";
});

describe("useNavbarOverlay", () => {
  it("stays solid when no element is marked with data-navbar-overlay", async () => {
    render(<TestConsumer />);
    // The route optimistically starts `true` (it's in NAVBAR_OVERLAY_ROUTES);
    // correcting to `false` when the marker turns out to be missing happens
    // via a deferred microtask (see `use-navbar-overlay.ts`'s comment on
    // `react-hooks/set-state-in-effect`), so this settles async, not on the
    // very next line after `render`.
    await waitFor(() => expect(screen.getByTestId("result")).toHaveTextContent("false"));
  });

  it("goes transparent while the marked element is intersecting the observed band", () => {
    document.body.insertAdjacentHTML("afterbegin", "<div data-navbar-overlay></div>");
    render(<TestConsumer />);

    expect(FakeIntersectionObserver.instances).toHaveLength(1);
    FakeIntersectionObserver.instances[0]!.trigger(true);

    expect(screen.getByTestId("result")).toHaveTextContent("true");
  });

  it("goes solid again once the marked element stops intersecting", () => {
    document.body.insertAdjacentHTML("afterbegin", "<div data-navbar-overlay></div>");
    render(<TestConsumer />);

    const observer = FakeIntersectionObserver.instances[0]!;
    observer.trigger(true);
    observer.trigger(false);

    expect(screen.getByTestId("result")).toHaveTextContent("false");
  });

  it("never observes anything on a route outside NAVBAR_OVERLAY_ROUTES, even if a stray element is marked", () => {
    usePathnameMock.mockReturnValue("/bicicletas");
    document.body.insertAdjacentHTML("afterbegin", "<div data-navbar-overlay></div>");

    render(<TestConsumer />);

    expect(FakeIntersectionObserver.instances).toHaveLength(0);
    expect(screen.getByTestId("result")).toHaveTextContent("false");
  });

  it("shrinks the observed band by the navbar's own height", () => {
    document.body.insertAdjacentHTML("afterbegin", "<div data-navbar-overlay></div>");
    render(<TestConsumer />);

    expect(FakeIntersectionObserver.instances[0]!.rootMargin).toBe("-64px 0px 0px 0px");
  });
});
