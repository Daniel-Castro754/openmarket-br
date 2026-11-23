"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { FinancialSeries } from "../../lib/api";
import { formatFinancialValue, formatPeriod } from "../../lib/format";

export function FinancialSeriesChart({
  series,
}: {
  series: FinancialSeries;
}) {
  const limit = series.frequency === "annual" ? 6 : 8;
  const points = series.points.slice(-limit);
  const latestCurrency = points.at(-1)?.currency;
  const data = points
    .map((point) => ({
      period: point.period_end,
      periodLabel: `${formatPeriod(point.period_end, series.frequency)}${point.derived ? " · D" : ""}`,
      value: Number(point.value),
      derived: point.derived,
    }))
    .filter((point) => Number.isFinite(point.value));

  const values = data.map((point) => point.value);
  const rawMin = Math.min(...values, 0);
  const rawMax = Math.max(...values, 0);
  const padding = rawMin === rawMax
    ? Math.abs(rawMin) * 0.1 || 1
    : Math.max((rawMax - rawMin) * 0.08, 0.000001);
  const domain: [number, number] = [
    rawMin === 0 ? 0 : rawMin - padding,
    rawMax === 0 ? 0 : rawMax + padding,
  ];

  return (
    <div
      className="series-chart series-chart-interactive"
      role="img"
      aria-label={`Histórico ${series.frequency === "annual" ? "anual" : "trimestral"} de ${series.label}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 7, right: 6, bottom: 2, left: 2 }}
          barCategoryGap="24%"
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--chart-grid)"
            strokeDasharray="2 4"
          />
          <XAxis
            dataKey="periodLabel"
            axisLine={false}
            tickLine={false}
            interval={0}
            tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
          />
          <YAxis
            width={54}
            domain={domain}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
            tickFormatter={(value) => formatFinancialValue(Number(value), series.unit, {
              currency: latestCurrency,
              showCurrency: false,
              percentDigits: 1,
            })}
          />
          <ReferenceLine
            y={0}
            stroke="var(--border-strong)"
            strokeWidth={1}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-hover)" }}
            contentStyle={{
              border: "1px solid var(--border-strong)",
              borderRadius: "4px",
              background: "var(--surface)",
              color: "var(--text-strong)",
              fontSize: "12px",
              padding: "7px 9px",
            }}
            labelFormatter={(label) => String(label)}
            formatter={(value) => [
              formatFinancialValue(Number(value), series.unit, {
                currency: latestCurrency,
                percentDigits: 1,
              }),
              series.label,
            ]}
          />
          <Bar
            dataKey="value"
            maxBarSize={42}
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          >
            {data.map((point) => (
              <Cell
                key={point.period}
                fill={point.value < 0 ? "var(--chart-negative)" : "var(--chart-primary)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
