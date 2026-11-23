"use client";

import type { IChartApi, ISeriesApi, LineData, Time } from "lightweight-charts";
import { useEffect, useMemo, useRef } from "react";

import type { PerformancePoint } from "../../../../lib/api";
import { formatDateShortPtBr } from "../../../../lib/format";
import styles from "./performance.module.css";

type ThemePalette = {
  surface: string;
  text: string;
  muted: string;
  border: string;
  grid: string;
  accent: string;
};

function cssValue(styles: CSSStyleDeclaration, name: string, fallback: string) {
  return styles.getPropertyValue(name).trim() || fallback;
}

function readPalette(): ThemePalette {
  const styles = getComputedStyle(document.documentElement);
  return {
    surface: cssValue(styles, "--surface", "#ffffff"),
    text: cssValue(styles, "--text-strong", "#111827"),
    muted: cssValue(styles, "--muted", "#6b7280"),
    border: cssValue(styles, "--border-strong", "#d1d5db"),
    grid: cssValue(styles, "--chart-grid", "#e5e7eb"),
    accent: cssValue(styles, "--chart-primary", "#2563eb"),
  };
}

function priceLabel(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function MarketPriceChart({
  ticker,
  points,
  priceBasis,
}: {
  ticker: string;
  points: PerformancePoint[];
  priceBasis: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const data = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const point of points) {
      const value = Number(point.price);
      if (!Number.isFinite(value) || !point.as_of) continue;
      byDate.set(point.as_of.slice(0, 10), value);
    }
    return [...byDate.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([time, value]) => ({ time: time as Time, value } satisfies LineData<Time>));
  }, [points]);

  useEffect(() => {
    let disposed = false;
    let observer: MutationObserver | null = null;

    async function mountChart() {
      if (!containerRef.current || !data.length) return;
      const { ColorType, CrosshairMode, LineSeries, createChart } = await import("lightweight-charts");
      if (disposed || !containerRef.current) return;

      const palette = readPalette();
      const chart = createChart(containerRef.current, {
        autoSize: true,
        layout: {
          background: { type: ColorType.Solid, color: palette.surface },
          textColor: palette.muted,
          attributionLogo: true,
        },
        grid: {
          vertLines: { color: palette.grid },
          horzLines: { color: palette.grid },
        },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: {
          borderColor: palette.border,
          scaleMargins: { top: 0.12, bottom: 0.12 },
        },
        timeScale: {
          borderColor: palette.border,
          rightOffset: 2,
          barSpacing: 6,
          minBarSpacing: 1,
        },
        localization: {
          locale: "pt-BR",
          priceFormatter: priceLabel,
        },
      });

      const series = chart.addSeries(LineSeries, {
        color: palette.accent,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 3,
        priceFormat: { type: "price", precision: 2, minMove: 0.01 },
      });
      series.setData(data);
      chart.timeScale().fitContent();

      chartRef.current = chart;
      seriesRef.current = series;

      observer = new MutationObserver(() => {
        if (!chartRef.current || !seriesRef.current) return;
        const next = readPalette();
        chartRef.current.applyOptions({
          layout: {
            background: { type: ColorType.Solid, color: next.surface },
            textColor: next.muted,
            attributionLogo: true,
          },
          grid: {
            vertLines: { color: next.grid },
            horzLines: { color: next.grid },
          },
          rightPriceScale: { borderColor: next.border },
          timeScale: { borderColor: next.border },
        });
        seriesRef.current.applyOptions({ color: next.accent });
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme", "style"],
      });
    }

    void mountChart();

    return () => {
      disposed = true;
      observer?.disconnect();
      seriesRef.current = null;
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [data]);

  const first = data[0];
  const last = data.at(-1);

  if (!data.length) return null;

  return (
    <section className={styles.marketChartPanel} aria-labelledby="market-price-chart-title">
      <header>
        <div>
          <span>PREÇO DE MERCADO</span>
          <h2 id="market-price-chart-title">{ticker} · fechamento</h2>
        </div>
        <div className={styles.marketChartLatest}>
          <span>Último</span>
          <strong>{last ? priceLabel(last.value) : "—"}</strong>
        </div>
      </header>

      <div
        ref={containerRef}
        className={styles.marketChart}
        role="img"
        aria-label={`Histórico interativo de preço de fechamento de ${ticker}`}
      />

      <footer>
        <span>{first ? formatDateShortPtBr(String(first.time)) : "—"}</span>
        <span>{priceBasis}</span>
        <span>{last ? formatDateShortPtBr(String(last.time)) : "—"}</span>
        <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
          Lightweight Charts™ by TradingView
        </a>
      </footer>
    </section>
  );
}
