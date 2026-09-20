"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { IndicatorHistory, SeriesUnit } from "../../../lib/api";
import { formatFinancialValue, formatYear } from "../../../lib/format";
import styles from "./indicator-dashboard.module.css";

type ChartMode = "bar" | "line";

function formatValue(value: string | number | null | undefined, unit: SeriesUnit) {
  return formatFinancialValue(value, unit, {
    showCurrency: false,
    percentDigits: 2,
    multipleDigits: 2,
  });
}

function chartDomain(values: number[], mode: ChartMode) {
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);

  let min = mode === "bar" ? Math.min(0, rawMin) : rawMin;
  let max = mode === "bar" ? Math.max(0, rawMax) : rawMax;

  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  } else if (mode === "line") {
    const pad = (max - min) * 0.12;
    min -= pad;
    max += pad;
  }

  return [min, max] as [number, number];
}

export function IndicatorHistoryChart({
  history,
  mode,
}: {
  history: IndicatorHistory;
  mode: ChartMode;
}) {
  const data = history.points
    .map((point) => ({
      period_end: point.period_end,
      value: Number(point.value),
    }))
    .filter((point) => Number.isFinite(point.value));

  if (!data.length) {
    return <div className={styles.emptyChart}>Não há histórico suficiente para este indicador.</div>;
  }

  const values = data.map((point) => point.value);
  const domain = chartDomain(values, mode);
  const average = history.historical_average == null
    ? null
    : Number(history.historical_average);
  const hasAverage = average != null && Number.isFinite(average);

  return (
    <div
      className={styles.chart}
      role="img"
      aria-label={`Histórico de ${history.definition.label}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 18, right: 18, bottom: 6, left: 8 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--chart-grid)"
            strokeDasharray="2 4"
          />
          <XAxis
            dataKey="period_end"
            tickFormatter={(value) => formatYear(String(value))}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
          />
          <YAxis
            width={70}
            domain={domain}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
            tickFormatter={(value) => formatValue(Number(value), history.definition.unit)}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-hover)", stroke: "var(--border-strong)" }}
            contentStyle={{
              border: "1px solid var(--border-strong)",
              borderRadius: "4px",
              background: "var(--surface)",
              color: "var(--text-strong)",
              fontSize: "12px",
              padding: "7px 9px",
            }}
            labelFormatter={(value) => formatYear(String(value))}
            formatter={(value) => [
              formatValue(Number(value), history.definition.unit),
              history.definition.label,
            ]}
          />

          {mode === "bar" ? (
            <ReferenceLine y={0} stroke="var(--border-strong)" strokeWidth={1.2} />
          ) : null}

          {hasAverage ? (
            <ReferenceLine
              y={average as number}
              stroke="var(--chart-secondary)"
              strokeDasharray="5 4"
              label={{
                value: `média ${formatValue(average as number, history.definition.unit)}`,
                position: "insideTopRight",
                fill: "var(--chart-secondary)",
                fontSize: 11,
              }}
            />
          ) : null}

          {mode === "bar" ? (
            <Bar
              dataKey="value"
              fill="var(--chart-primary)"
              radius={[3, 3, 0, 0]}
              maxBarSize={56}
              isAnimationActive={false}
            />
          ) : (
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--chart-primary)"
              strokeWidth={2.3}
              dot={{
                r: 3,
                fill: "var(--surface)",
                stroke: "var(--chart-primary)",
                strokeWidth: 1.8,
              }}
              activeDot={{
                r: 4,
                fill: "var(--surface)",
                stroke: "var(--chart-primary)",
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
