import Link from "next/link";

import type {
  IndicatorHistory,
  IndicatorSummary,
  IndicatorValue,
  SeriesFrequency,
  SeriesUnit,
} from "../../../lib/api";
import styles from "./indicator-dashboard.module.css";

type ChartMode = "bar" | "line";

type Props = {
  ticker: string;
  summary: IndicatorSummary;
  history?: IndicatorHistory | null;
  selectedSlug?: string | null;
  years: 5 | 10;
  chartMode: ChartMode;
  pageFrequency: SeriesFrequency;
};

const compactNumber = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const decimalNumber = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

function formatIndicatorValue(value: string | number | null | undefined, unit: SeriesUnit) {
  if (value == null) return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  if (unit === "percent") return `${decimalNumber.format(numeric)}%`;
  return `R$ ${compactNumber.format(numeric)}`;
}

function yearLabel(period?: string | null) {
  if (!period) return "sem período";
  return period.slice(0, 4);
}

function historyHref(
  ticker: string,
  slug: string,
  years: 5 | 10,
  chartMode: ChartMode,
  pageFrequency: SeriesFrequency,
) {
  const params = new URLSearchParams({
    indicator: slug,
    years: String(years),
    chart: chartMode,
  });
  if (pageFrequency === "quarterly") params.set("view", "quarterly");
  return `/ativos/${ticker}?${params.toString()}#indicator-history`;
}

function closeHref(ticker: string, pageFrequency: SeriesFrequency) {
  return pageFrequency === "quarterly"
    ? `/ativos/${ticker}?view=quarterly#indicadores-fundamentais`
    : `/ativos/${ticker}#indicadores-fundamentais`;
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 15.5V4.5M3 15.5h14M6 12l3-3 2 2 4-5" />
      <circle cx="6" cy="12" r=".8" />
      <circle cx="9" cy="9" r=".8" />
      <circle cx="11" cy="11" r=".8" />
      <circle cx="15" cy="6" r=".8" />
    </svg>
  );
}

function IndicatorCard({
  ticker,
  indicator,
  years,
  chartMode,
  pageFrequency,
}: {
  ticker: string;
  indicator: IndicatorValue;
  years: 5 | 10;
  chartMode: ChartMode;
  pageFrequency: SeriesFrequency;
}) {
  return (
    <article className={styles.card}>
      <div className={styles.cardHeading}>
        <span>{indicator.label}</span>
        <span className={styles.help} title={indicator.description}>?</span>
      </div>
      <div className={styles.cardValueRow}>
        <strong>{formatIndicatorValue(indicator.value, indicator.unit)}</strong>
        {indicator.supports_history ? (
          <Link
            className={styles.chartButton}
            href={historyHref(ticker, indicator.slug, years, chartMode, pageFrequency)}
            aria-label={`Abrir histórico de ${indicator.label}`}
            title={`Histórico de ${indicator.label}`}
          >
            <ChartIcon />
          </Link>
        ) : null}
      </div>
      <small>
        {indicator.period_end ? yearLabel(indicator.period_end) : "sem dado"}
        {indicator.derived ? " · calculado" : ""}
      </small>
    </article>
  );
}

function HistoricalChart({ history, mode }: { history: IndicatorHistory; mode: ChartMode }) {
  const values = history.points.map((point) => Number(point.value)).filter(Number.isFinite);
  if (!values.length) {
    return <div className={styles.emptyChart}>Não há histórico suficiente para este indicador.</div>;
  }

  const width = 820;
  const height = 270;
  const left = 56;
  const right = 24;
  const top = 28;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
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

  const y = (value: number) => top + ((max - value) / (max - min)) * plotHeight;
  const x = (index: number) =>
    left + ((index + 0.5) / history.points.length) * plotWidth;
  const zeroY = y(0);
  const gridValues = Array.from({ length: 5 }, (_, index) => max - ((max - min) * index) / 4);
  const average = history.historical_average == null ? null : Number(history.historical_average);
  const linePoints = history.points
    .map((point, index) => `${x(index).toFixed(2)},${y(Number(point.value)).toFixed(2)}`)
    .join(" ");
  const barWidth = Math.min(52, Math.max(18, plotWidth / Math.max(history.points.length * 1.8, 1)));

  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Histórico de ${history.definition.label}`}
    >
      {gridValues.map((gridValue) => {
        const gridY = y(gridValue);
        return (
          <g key={gridValue.toFixed(6)}>
            <line className={styles.gridLine} x1={left} y1={gridY} x2={width - right} y2={gridY} />
            <text className={styles.axisLabel} x={left - 8} y={gridY + 4} textAnchor="end">
              {history.definition.unit === "percent"
                ? `${decimalNumber.format(gridValue)}%`
                : compactNumber.format(gridValue)}
            </text>
          </g>
        );
      })}

      {mode === "bar" ? <line className={styles.zeroLine} x1={left} y1={zeroY} x2={width - right} y2={zeroY} /> : null}

      {average != null && Number.isFinite(average) ? (
        <g>
          <line className={styles.averageLine} x1={left} y1={y(average)} x2={width - right} y2={y(average)} />
          <text className={styles.averageLabel} x={width - right} y={y(average) - 6} textAnchor="end">
            média {formatIndicatorValue(average, history.definition.unit)}
          </text>
        </g>
      ) : null}

      {mode === "bar" ? (
        history.points.map((point, index) => {
          const value = Number(point.value);
          const valueY = y(value);
          const rectY = Math.min(valueY, zeroY);
          const rectHeight = Math.max(2, Math.abs(zeroY - valueY));
          return (
            <g key={point.period_end}>
              <rect
                className={styles.bar}
                x={x(index) - barWidth / 2}
                y={rectY}
                width={barWidth}
                height={rectHeight}
                rx="4"
              />
              <text
                className={styles.valueLabel}
                x={x(index)}
                y={value >= 0 ? rectY - 7 : rectY + rectHeight + 14}
                textAnchor="middle"
              >
                {history.definition.unit === "percent"
                  ? `${decimalNumber.format(value)}%`
                  : compactNumber.format(value)}
              </text>
            </g>
          );
        })
      ) : (
        <g>
          <polyline className={styles.line} points={linePoints} />
          {history.points.map((point, index) => (
            <circle
              className={styles.point}
              cx={x(index)}
              cy={y(Number(point.value))}
              r="4"
              key={point.period_end}
            />
          ))}
        </g>
      )}

      {history.points.map((point, index) => (
        <text className={styles.xLabel} x={x(index)} y={height - 14} textAnchor="middle" key={`x-${point.period_end}`}>
          {yearLabel(point.period_end)}
        </text>
      ))}
    </svg>
  );
}

function HistoryModal({
  ticker,
  summary,
  history,
  years,
  chartMode,
  pageFrequency,
}: {
  ticker: string;
  summary: IndicatorSummary;
  history: IndicatorHistory;
  years: 5 | 10;
  chartMode: ChartMode;
  pageFrequency: SeriesFrequency;
}) {
  const allIndicators = summary.groups.flatMap((group) => group.indicators);
  return (
    <div className={styles.backdrop} id="indicator-history" role="presentation">
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="indicator-history-title">
        <header className={styles.modalHeader}>
          <div>
            <span className="eyebrow">HISTÓRICO DE INDICADORES</span>
            <h2 id="indicator-history-title">{history.definition.label} · {ticker}</h2>
          </div>
          <Link className={styles.close} href={closeHref(ticker, pageFrequency)} aria-label="Fechar histórico">×</Link>
        </header>

        <div className={styles.modalToolbar}>
          <form className={styles.indicatorSelector} method="get" action={`/ativos/${ticker}`}>
            {pageFrequency === "quarterly" ? <input type="hidden" name="view" value="quarterly" /> : null}
            <input type="hidden" name="years" value={years} />
            <input type="hidden" name="chart" value={chartMode} />
            <label>
              <span>Indicador</span>
              <select name="indicator" defaultValue={history.definition.slug}>
                {allIndicators.map((indicator) => (
                  <option value={indicator.slug} key={indicator.slug}>{indicator.label}</option>
                ))}
              </select>
            </label>
            <button type="submit">Exibir</button>
          </form>

          <div className={styles.toolbarToggles}>
            <div className={styles.toggleGroup} aria-label="Janela histórica">
              {([5, 10] as const).map((window) => (
                <Link
                  className={years === window ? styles.activeToggle : ""}
                  href={historyHref(ticker, history.definition.slug, window, chartMode, pageFrequency)}
                  key={window}
                >
                  {window}A
                </Link>
              ))}
            </div>
            <div className={styles.toggleGroup} aria-label="Tipo de gráfico">
              {(["line", "bar"] as const).map((mode) => (
                <Link
                  className={chartMode === mode ? styles.activeToggle : ""}
                  href={historyHref(ticker, history.definition.slug, years, mode, pageFrequency)}
                  key={mode}
                >
                  {mode === "line" ? "Linha" : "Barra"}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.historyStats}>
          <div><span>Valor atual</span><strong>{formatIndicatorValue(history.current_value, history.definition.unit)}</strong></div>
          <div><span>Média da empresa</span><strong>{formatIndicatorValue(history.historical_average, history.definition.unit)}</strong></div>
          <div><span>Período atual</span><strong>{yearLabel(history.current_period)}</strong></div>
        </div>

        <HistoricalChart history={history} mode={chartMode} />

        <div className={styles.historyTableWrap}>
          <table className={styles.historyTable}>
            <thead>
              <tr>
                <th>Indicador</th>
                {history.points.slice().reverse().map((point) => <th key={point.period_end}>{yearLabel(point.period_end)}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>{history.definition.label}</th>
                {history.points.slice().reverse().map((point) => (
                  <td key={point.period_end}>{formatIndicatorValue(point.value, history.definition.unit)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <footer className={styles.modalFooter}>
          <span>{history.definition.description}</span>
          <span>Fórmula: {history.definition.formula ?? "dado direto"}</span>
          <span>Base: CVM · proveniência preservada em cada ponto</span>
        </footer>
      </section>
    </div>
  );
}

export function IndicatorDashboard({
  ticker,
  summary,
  history,
  selectedSlug,
  years,
  chartMode,
  pageFrequency,
}: Props) {
  return (
    <section className={styles.section} id="indicadores-fundamentais">
      <div className={styles.sectionHeading}>
        <div>
          <span className="eyebrow">INDICADORES FUNDAMENTALISTAS</span>
          <h2>Fundamentos organizados por categoria</h2>
          <p>Valores anuais consolidados calculados a partir das demonstrações oficiais da CVM.</p>
        </div>
        <span className={styles.sourceBadge}>CVM · anual</span>
      </div>

      <div className={styles.groups}>
        {summary.groups.map((group) => (
          <section className={styles.group} key={group.group}>
            <h3>{group.label}</h3>
            <div className={styles.grid}>
              {group.indicators.map((indicator) => (
                <IndicatorCard
                  ticker={ticker}
                  indicator={indicator}
                  years={years}
                  chartMode={chartMode}
                  pageFrequency={pageFrequency}
                  key={indicator.slug}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className={styles.note}>
        Múltiplos de valuation dependentes de cotação (P/L, P/VP, EV/EBITDA e DY) serão adicionados somente após a integração de uma fonte de preços com licença adequada.
      </p>

      {history && selectedSlug ? (
        <HistoryModal
          ticker={ticker}
          summary={summary}
          history={history}
          years={years}
          chartMode={chartMode}
          pageFrequency={pageFrequency}
        />
      ) : null}
    </section>
  );
}
