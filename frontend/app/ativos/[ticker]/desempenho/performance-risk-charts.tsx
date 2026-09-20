"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { PerformancePoint } from "../../../../lib/api";
import { formatDateShortPtBr } from "../../../../lib/format";
import styles from "./performance.module.css";

function axisDate(value: string) {
  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(parsed);
}

function fullDate(value: string) {
  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function indexValue(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value);
}

function percentValue(value: number) {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

export function PerformanceRiskCharts({
  points,
  observations,
  start,
  end,
  maxDrawdownPercent,
}: {
  points: PerformancePoint[];
  observations: number;
  start?: string | null;
  end?: string | null;
  maxDrawdownPercent?: string | null;
}) {
  const data = points
    .map((point) => ({
      as_of: point.as_of,
      normalized: Number(point.normalized_value),
      drawdown: Number(point.drawdown_percent),
    }))
    .filter((point) => Number.isFinite(point.normalized) && Number.isFinite(point.drawdown));

  const maxDrawdown = maxDrawdownPercent == null
    ? "—"
    : percentValue(Number(maxDrawdownPercent));

  return (
    <div className={styles.chartGrid}>
      <section className={styles.chartPanel}>
        <header>
          <div>
            <span>PREÇO NORMALIZADO</span>
            <h2>Base 100</h2>
          </div>
          <small>{observations.toLocaleString("pt-BR")} pregões</small>
        </header>

        <div
          className={styles.chart}
          role="img"
          aria-label="Curva de preço normalizada, base 100"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              syncId="performance-risk"
              margin={{ top: 8, right: 8, bottom: 2, left: 2 }}
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeDasharray="2 4"
              />
              <XAxis
                dataKey="as_of"
                tickFormatter={axisDate}
                minTickGap={42}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted)", fontSize: 12 }}
              />
              <YAxis
                width={48}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted)", fontSize: 12 }}
                tickFormatter={(value) => indexValue(Number(value))}
                domain={["auto", "auto"]}
              />
              <ReferenceLine
                y={100}
                stroke="var(--border-strong)"
                strokeDasharray="3 3"
              />
              <Tooltip
                cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
                contentStyle={{
                  border: "1px solid var(--border-strong)",
                  borderRadius: "4px",
                  background: "var(--surface)",
                  color: "var(--text-strong)",
                  fontSize: "12px",
                  padding: "7px 9px",
                }}
                labelFormatter={(value) => fullDate(String(value))}
                formatter={(value) => [indexValue(Number(value)), "Base 100"]}
              />
              <Line
                type="monotone"
                dataKey="normalized"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 3,
                  fill: "var(--surface)",
                  stroke: "var(--accent)",
                  strokeWidth: 1.5,
                }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <footer>
          <span>{start ? formatDateShortPtBr(start) : "—"}</span>
          <span>100 = início da janela</span>
          <span>{end ? formatDateShortPtBr(end) : "—"}</span>
        </footer>
      </section>

      <section className={styles.chartPanel}>
        <header>
          <div>
            <span>DRAWDOWN</span>
            <h2>Queda desde o pico</h2>
          </div>
          <small>máx. {maxDrawdown}</small>
        </header>

        <div
          className={styles.chart}
          role="img"
          aria-label="Curva de drawdown"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              syncId="performance-risk"
              margin={{ top: 8, right: 8, bottom: 2, left: 2 }}
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeDasharray="2 4"
              />
              <XAxis
                dataKey="as_of"
                tickFormatter={axisDate}
                minTickGap={42}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted)", fontSize: 12 }}
              />
              <YAxis
                width={48}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted)", fontSize: 12 }}
                tickFormatter={(value) => percentValue(Number(value))}
                domain={["dataMin", 0]}
              />
              <ReferenceLine y={0} stroke="var(--border-strong)" />
              <Tooltip
                cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
                contentStyle={{
                  border: "1px solid var(--border-strong)",
                  borderRadius: "4px",
                  background: "var(--surface)",
                  color: "var(--text-strong)",
                  fontSize: "12px",
                  padding: "7px 9px",
                }}
                labelFormatter={(value) => fullDate(String(value))}
                formatter={(value) => [percentValue(Number(value)), "Drawdown"]}
              />
              <Area
                type="monotone"
                dataKey="drawdown"
                stroke="var(--warning)"
                strokeWidth={2}
                fill="var(--warning)"
                fillOpacity={0.08}
                dot={false}
                activeDot={{
                  r: 3,
                  fill: "var(--surface)",
                  stroke: "var(--warning)",
                  strokeWidth: 1.5,
                }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <footer>
          <span>0% = novo pico</span>
          <span>quanto mais negativo, maior a queda</span>
        </footer>
      </section>
    </div>
  );
}
