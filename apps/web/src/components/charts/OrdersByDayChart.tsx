"use client";

import type { OrdersStats } from "@bw-bikes/shared";
import { useId, useState } from "react";
import { CHART_COLORS, CHART_MARKS } from "./chart-theme";

export interface OrdersByDayChartProps {
  ordersByDay: OrdersStats["ordersByDay"];
}

const DAY_FORMATTER = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });

/**
 * `date` arrives as a bare `"YYYY-MM-DD"` string. Parsing it with `new
 * Date(string)` reads it as UTC midnight, which in every Mexican timezone
 * (all behind UTC) displays as the *previous* evening — split it and build
 * a local-time `Date` instead.
 */
function formatDay(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return DAY_FORMATTER.format(new Date(year!, month! - 1, day!));
}

const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 28, left: 40 };
const POINT_GAP = 48;

/**
 * Single-series area — órdenes por día, serie única en grafito. Hand-rolled
 * SVG rather than a charting library: this project's only two chart needs
 * (this and `RankedBarChart`) are simple enough not to justify a dependency,
 * and Recharts (both the redux-backed v3 and the plain v2) fails Next's
 * build-time page-data collection with `createContext is not a function` —
 * an untagged (`"use client"`-less) library calling `createContext` gets
 * walked into the RSC graph regardless of an `ssr:false` dynamic import.
 * No hay ingresos por día en el backend (solo conteo), así que este sigue
 * siendo el único gráfico temporal de M11 — una sola serie no necesita
 * leyenda, el título de `ChartCard` ya dice qué se grafica.
 */
export function OrdersByDayChart({ ordersByDay }: OrdersByDayChartProps) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const width = PADDING.left + PADDING.right + Math.max(ordersByDay.length - 1, 1) * POINT_GAP;
  const maxCount = Math.max(...ordersByDay.map((day) => day.count), 1);
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  function xAt(index: number): number {
    return PADDING.left + index * POINT_GAP;
  }
  function yAt(count: number): number {
    return PADDING.top + plotHeight - (count / maxCount) * plotHeight;
  }

  const linePoints = ordersByDay.map((day, index) => `${xAt(index)},${yAt(day.count)}`).join(" ");
  const areaPoints = `${xAt(0)},${PADDING.top + plotHeight} ${linePoints} ${xAt(ordersByDay.length - 1)},${PADDING.top + plotHeight}`;

  // Four horizontal gridlines at clean fractions of the max, never at
  // arbitrary values — the `dataviz` skill's "round to clean numbers" rule.
  const gridTicks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => Math.round(maxCount * fraction));

  const hovered = hoverIndex !== null ? ordersByDay[hoverIndex] : undefined;

  return (
    <div className="relative" style={{ width, minWidth: "100%" }}>
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        width={width}
        height={HEIGHT}
        role="img"
        aria-label="Órdenes por día"
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const scale = width / rect.width;
          const relativeX = (event.clientX - rect.left) * scale;
          const index = Math.round((relativeX - PADDING.left) / POINT_GAP);
          setHoverIndex(Math.min(Math.max(index, 0), ordersByDay.length - 1));
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.series} stopOpacity={CHART_MARKS.areaOpacity} />
            <stop offset="100%" stopColor={CHART_COLORS.series} stopOpacity={0} />
          </linearGradient>
        </defs>

        {gridTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={PADDING.left}
              x2={width - PADDING.right}
              y1={yAt(tick)}
              y2={yAt(tick)}
              stroke={CHART_COLORS.grid}
              strokeWidth={1}
            />
            <text x={PADDING.left - 8} y={yAt(tick)} dy={4} textAnchor="end" fontSize={11} fill={CHART_COLORS.axisText}>
              {tick}
            </text>
          </g>
        ))}

        {ordersByDay.map((day, index) => (
          <text
            key={day.date}
            x={xAt(index)}
            y={HEIGHT - 8}
            textAnchor="middle"
            fontSize={11}
            fill={CHART_COLORS.axisText}
          >
            {formatDay(day.date)}
          </text>
        ))}

        <polygon points={areaPoints} fill={`url(#${gradientId})`} />
        <polyline
          points={linePoints}
          fill="none"
          stroke={CHART_COLORS.series}
          strokeWidth={CHART_MARKS.lineWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {hoverIndex !== null ? (
          <>
            <line
              x1={xAt(hoverIndex)}
              x2={xAt(hoverIndex)}
              y1={PADDING.top}
              y2={PADDING.top + plotHeight}
              stroke={CHART_COLORS.grid}
              strokeWidth={1}
            />
            <circle
              cx={xAt(hoverIndex)}
              cy={yAt(ordersByDay[hoverIndex]!.count)}
              r={4}
              fill={CHART_COLORS.series}
              stroke={CHART_COLORS.tooltipBg}
              strokeWidth={2}
            />
          </>
        ) : null}
      </svg>

      {hovered ? (
        <div
          className="pointer-events-none absolute rounded-control border border-borde bg-surface px-sm py-xs font-body text-caption text-negro"
          style={{ left: `${(xAt(hoverIndex!) / width) * 100}%`, top: 0, transform: "translate(-50%, -100%)" }}
        >
          <p className="font-ui text-ui">{formatDay(hovered.date)}</p>
          <p className="text-grafito">
            {hovered.count} {hovered.count === 1 ? "orden" : "órdenes"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
