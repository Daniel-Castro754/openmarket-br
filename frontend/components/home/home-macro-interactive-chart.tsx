"use client";

import { useMemo, useState } from "react";

import type { MacroSeriesPoint } from "../../lib/macro-api";

type ChartPoint = MacroSeriesPoint & {
  numericValue: number;
  x: number;
  y: number;
};

function formatValue(value: number, unit: string) {
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: unit.startsWith("%") ? 2 : 1,
    maximumFractionDigits: 2,
  }).format(value);

  if (unit.startsWith("%")) return `${formatted}%`;
  if (unit.includes("R$/")) return `R$ ${formatted}`;
  return formatted;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    timeZone: "UTC",
  })
    .format(new Date(`${value}T00:00:00Z`))
    .replace(".", "");
}

function buildMonthTicks(points: ChartPoint[]) {
  const unique: Array<{ index: number; key: string; label: string }> = [];

  points.forEach((point, index) => {
    const key = point.reference_date.slice(0, 7);
    if (unique.at(-1)?.key !== key) {
      unique.push({ index, key, label: monthLabel(point.reference_date) });
    }
  });

  if (unique.length <= 6) return unique;

  const selected = new Map<number, (typeof unique)[number]>();
  const slots = 6;
  for (let slot = 0; slot < slots; slot += 1) {
    const position = Math.round((slot / (slots - 1)) * (unique.length - 1));
    selected.set(position, unique[position]);
  }

  return [...selected.values()];
}

export function HomeMacroInteractiveChart({
  points,
  unit,
  label,
}: {
  points: MacroSeriesPoint[];
  unit: string;
  label: string;
}) {
  const chartPoints = useMemo<ChartPoint[]>(() => {
    const valid = points
      .slice(-18)
      .map((point) => ({ ...point, numericValue: Number(point.value) }))
      .filter((point) => Number.isFinite(point.numericValue));

    if (valid.length < 2) return [];

    const values = valid.map((point) => point.numericValue);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = max - min || 1;

    return valid.map((point, index) => ({
      ...point,
      x: 3 + (index / (valid.length - 1)) * 94,
      y: 4 + (1 - (point.numericValue - min) / spread) * 23,
    }));
  }, [points]);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (chartPoints.length < 2) {
    return <span className="home-v2-chart-empty">Histórico curto ainda indisponível.</span>;
  }

  const activeIndex = hoveredIndex ?? selectedIndex;
  const activePoint = activeIndex == null ? null : chartPoints[activeIndex];
  const ticks = buildMonthTicks(chartPoints);
  const polyline = chartPoints.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");

  function indexFromPointer(clientX: number, element: HTMLDivElement) {
    const bounds = element.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
    return Math.round(ratio * (chartPoints.length - 1));
  }

  return (
    <div
      className="home-v2-interactive-chart"
      role="img"
      aria-label={`Histórico recente de ${label}. Passe ou clique sobre a linha para consultar os valores.`}
      onPointerMove={(event) => setHoveredIndex(indexFromPointer(event.clientX, event.currentTarget))}
      onPointerLeave={() => setHoveredIndex(null)}
      onClick={(event) => setSelectedIndex(indexFromPointer(event.clientX, event.currentTarget))}
    >
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
        <line className="home-v2-chart-baseline" x1="3" y1="29" x2="97" y2="29" />
        <polyline className="home-v2-chart-line" points={polyline} />
        {activePoint ? (
          <>
            <line
              className="home-v2-chart-guide"
              x1={activePoint.x}
              y1="2"
              x2={activePoint.x}
              y2="29"
            />
            <circle className="home-v2-chart-active-point" cx={activePoint.x} cy={activePoint.y} r="1.55" />
          </>
        ) : null}
      </svg>

      <div className="home-v2-chart-months" aria-hidden="true">
        {ticks.map((tick) => {
          const point = chartPoints[tick.index];
          return (
            <span key={tick.key} style={{ left: `${point.x}%` }}>
              {tick.label}
            </span>
          );
        })}
      </div>

      {activePoint ? (
        <div
          className="home-v2-chart-tooltip"
          style={{
            left: `${Math.min(91, Math.max(9, activePoint.x))}%`,
            top: `${Math.max(8, (activePoint.y / 32) * 76)}%`,
          }}
        >
          <strong>{formatValue(activePoint.numericValue, unit)}</strong>
          <span>{formatDate(activePoint.reference_date)}</span>
        </div>
      ) : null}

      <span className="home-v2-chart-hint">Passe ou clique para ver o valor</span>
    </div>
  );
}
