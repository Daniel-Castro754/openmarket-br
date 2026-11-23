"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

import type { MacroSeriesPoint } from "../../lib/macro-api";

function formatDate(value: string) {
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(parsed);
}

function formatValue(value: number, unit: string) {
  const formatted = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: unit.includes("R$/") ? 2 : 1,
  }).format(value);

  if (unit.startsWith("%")) return `${formatted}%`;
  if (unit.includes("R$/")) return `R$ ${formatted}`;
  return formatted;
}

export function MacroSparkline({
  points,
  label,
  unit,
  className,
}: {
  points: MacroSeriesPoint[];
  label: string;
  unit: string;
  className?: string;
}) {
  const data = points
    .map((point) => ({
      reference_date: point.reference_date,
      value: Number(point.value),
    }))
    .filter((point) => Number.isFinite(point.value));

  if (data.length < 2) return <div className={className} aria-hidden="true" />;

  return (
    <div className={className} role="img" aria-label={`Histórico de ${label}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 3, right: 3, bottom: 3, left: 3 }}>
          <XAxis dataKey="reference_date" hide />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            contentStyle={{
              border: "1px solid var(--border-strong)",
              borderRadius: "4px",
              background: "var(--surface)",
              color: "var(--text-strong)",
              fontSize: "12px",
              padding: "6px 8px",
            }}
            labelFormatter={(value) => formatDate(String(value))}
            formatter={(value) => [
              formatValue(Number(value), unit),
              label,
            ]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--info)"
            strokeWidth={1.8}
            dot={false}
            activeDot={{
              r: 2.5,
              fill: "var(--surface)",
              stroke: "var(--info)",
              strokeWidth: 1.5,
            }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
