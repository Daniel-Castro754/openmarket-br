"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { SeriesFrequency, SeriesUnit } from "../../lib/api";
import { formatFinancialValue, formatYear } from "../../lib/format";
import styles from "../../app/comparar/compare.module.css";

export type CompareVisualMetric = {
  key: string;
  label: string;
  unit: SeriesUnit;
  frequency: SeriesFrequency;
  values: Array<{
    ticker: string;
    value: number;
    currency?: string | null;
    period?: string | null;
  }>;
};

function periodLabel(value: string | null | undefined, frequency: SeriesFrequency) {
  if (!value) return "período indisponível";
  if (frequency === "annual") return formatYear(value);
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  const quarter = Math.ceil((parsed.getUTCMonth() + 1) / 3);
  return `${quarter}T ${parsed.getUTCFullYear()}`;
}

function formatValue(value: number, metric: CompareVisualMetric) {
  const currency = metric.values.find((item) => item.currency)?.currency;
  return formatFinancialValue(value, metric.unit, {
    currency,
    percentDigits: 1,
    multipleDigits: 2,
    fallback: "—",
  });
}

export function CompareVisualGrid({ metrics }: { metrics: CompareVisualMetric[] }) {
  if (!metrics.length) return null;

  return (
    <section className={styles.visualSection} aria-labelledby="compare-visual-title">
      <header className={styles.visualHeading}>
        <div>
          <span>Leitura visual</span>
          <h2 id="compare-visual-title">Métricas em paralelo</h2>
        </div>
        <p>Visão rápida dos valores disponíveis. A tabela abaixo continua sendo a referência para período e proveniência.</p>
      </header>

      <div className={styles.visualGrid}>
        {metrics.map((metric) => (
          <article className={styles.visualCard} key={metric.key}>
            <header>
              <div>
                <strong>{metric.label}</strong>
                <small>{metric.frequency === "annual" ? "Anual" : "Trimestral"}</small>
              </div>
              <span>{metric.values.length} empresa(s)</span>
            </header>

            <div className={styles.visualChart} role="img" aria-label={`Comparação visual de ${metric.label}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={metric.values}
                  layout="vertical"
                  margin={{ top: 6, right: 12, bottom: 8, left: 4 }}
                  barCategoryGap="24%"
                >
                  <CartesianGrid horizontal={false} stroke="var(--chart-grid)" strokeDasharray="2 4" />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
                    tickFormatter={(value) => formatValue(Number(value), metric)}
                  />
                  <YAxis
                    type="category"
                    dataKey="ticker"
                    width={52}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--text-strong)", fontSize: 11, fontWeight: 700 }}
                  />
                  <ReferenceLine x={0} stroke="var(--border-strong)" strokeWidth={1} />
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
                    formatter={(value, _name, item) => {
                      const source = item.payload as CompareVisualMetric["values"][number];
                      return [
                        `${formatValue(Number(value), metric)} · ${periodLabel(source.period, metric.frequency)}`,
                        metric.label,
                      ];
                    }}
                  />
                  <Bar dataKey="value" maxBarSize={30} radius={[0, 3, 3, 0]} isAnimationActive={false}>
                    {metric.values.map((item) => (
                      <Cell
                        key={`${metric.key}-${item.ticker}`}
                        fill={item.value < 0 ? "var(--chart-negative)" : "var(--chart-primary)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
