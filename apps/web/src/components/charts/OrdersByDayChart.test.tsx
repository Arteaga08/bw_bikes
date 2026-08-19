import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrdersByDayChart } from "./OrdersByDayChart";

const RANGE = { from: "2026-07-19T00:00:00.000Z", to: "2026-08-18T00:00:00.000Z" }; // 30-day window

function bars(container: HTMLElement) {
  return Array.from(container.querySelectorAll("rect"));
}

describe("OrdersByDayChart", () => {
  it("positions a bar by its real day offset in the window, not by index", () => {
    // Two points a day apart at the very start of a 30-day window should sit
    // near the chart's left edge, close together — not evenly spread across
    // the whole plot width the way index-based spacing would place them.
    const { container } = render(
      <OrdersByDayChart
        data={[
          { date: "2026-07-19", value: 100 },
          { date: "2026-07-20", value: 50 },
        ]}
        range={RANGE}
        formatValue={(v) => `$${v}`}
        ariaLabel="Ingresos por día"
      />,
    );

    const [first, second] = bars(container);
    const x1 = Number(first!.getAttribute("x"));
    const x2 = Number(second!.getAttribute("x"));
    // Both bars land in roughly the first 1/15th of the plot (1 day out of 30),
    // nowhere near the chart's right edge.
    expect(x1).toBeLessThan(120);
    expect(x2).toBeLessThan(150);
  });

  it("leaves a wide empty stretch when active days cluster at the end of a sparse window", () => {
    const { container } = render(
      <OrdersByDayChart
        data={[{ date: "2026-08-18", value: 100 }]}
        range={RANGE}
        formatValue={(v) => `$${v}`}
        ariaLabel="Ingresos por día"
      />,
    );

    const [only] = bars(container);
    const x = Number(only!.getAttribute("x"));
    // The single active day is the window's last day — its bar sits near the
    // right edge of the ~730px plot area (800 viewBox minus padding), not at
    // the left edge an index-based layout would have placed it at.
    expect(x).toBeGreaterThan(600);
  });

  it("highlights only the highest-value bar with the accent color and a value label", () => {
    const { container } = render(
      <OrdersByDayChart
        data={[
          { date: "2026-08-10", value: 50_000 },
          { date: "2026-08-15", value: 200_000 },
          { date: "2026-08-17", value: 80_000 },
        ]}
        range={RANGE}
        formatValue={(v) => `$${v.toLocaleString("es-MX")}`}
        ariaLabel="Ingresos por día"
      />,
    );

    const rects = bars(container);
    expect(rects.map((r) => r.getAttribute("fill"))).toEqual([
      "var(--color-grafito)",
      "var(--color-dorado)",
      "var(--color-grafito)",
    ]);

    // Only the max bar gets a standalone value label (font-weight 500 is
    // this label's own distinguishing mark — axis ticks and date labels
    // don't set it, and gridline fractions of `maxValue` can coincidentally
    // equal another bar's raw value, so text content alone isn't a safe
    // enough selector here).
    const valueLabels = Array.from(container.querySelectorAll('text[font-weight="500"]')).map((el) => el.textContent);
    expect(valueLabels).toEqual(["$200,000"]);
  });

  it("gives every bar a native title with its date, value, and optional detail", () => {
    const { container } = render(
      <OrdersByDayChart
        data={[{ date: "2026-08-18", value: 100 }]}
        range={RANGE}
        formatValue={(v) => `$${v}`}
        ariaLabel="Ingresos por día"
        tooltipDetail={() => "3 órdenes"}
      />,
    );

    expect(container.querySelector("title")?.textContent).toBe("18 ago: $100 · 3 órdenes");
  });
});
