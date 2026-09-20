import Link from "next/link";

import type {
  IndicatorDataPassport,
  IndicatorHistory,
  IndicatorPassportInput,
  IndicatorSummary,
  IndicatorValue,
  SeriesFrequency,
  SeriesUnit,
} from "../../../lib/api";
import { provenanceKind, provenanceLabel } from "../../../lib/data-semantics";
import { formatFinancialValue, formatYear } from "../../../lib/format";
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
  passport?: IndicatorDataPassport | null;
  passportSlug?: string | null;
};

function formatIndicatorValue(value: string | number | null | undefined, unit: SeriesUnit) {
  return formatFinancialValue(value, unit, {
    percentDigits: 2,
    multipleDigits: 2,
  });
}

function formatChartValue(value: number, unit: SeriesUnit) {
  return formatFinancialValue(value, unit, {
    showCurrency: false,
    percentDigits: 2,
    multipleDigits: 2,
  });
}

function yearLabel(period?: string | null) {
  return formatYear(period);
}

function hasIndicatorValue(indicator: IndicatorValue) {
  return indicator.value != null && String(indicator.value).trim() !== "";
}

function historyHref(ticker: string, slug: string, years: 5 | 10, chartMode: ChartMode) {
  const params = new URLSearchParams({
    indicator: slug,
    years: String(years),
    chart: chartMode,
  });
  return `/ativos/${ticker}/indicadores?${params.toString()}#indicator-history`;
}

function passportHref(ticker: string, slug: string) {
  const params = new URLSearchParams({ passport: slug });
  return `/ativos/${ticker}/indicadores?${params.toString()}#data-passport`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("pt-BR").format(parsed);
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(parsed);
}

function formatPassportInput(input: IndicatorPassportInput) {
  if (input.restricted || input.value == null) return "Restrito pela licença";
  return formatFinancialValue(input.value, input.unit, {
    currency: input.currency,
    percentDigits: 2,
    multipleDigits: 2,
  });
}

function groupDescription(label: string) {
  const normalized = label.toLocaleLowerCase("pt-BR");
  if (normalized.includes("efici")) return "Margens e eficiência operacional da companhia.";
  if (normalized.includes("rentab")) return "Retorno gerado sobre patrimônio e ativos.";
  if (normalized.includes("liquid")) return "Capacidade de honrar obrigações de curto prazo.";
  if (normalized.includes("endivid")) return "Estrutura de capital e relação entre dívida e patrimônio.";
  if (normalized.includes("cresci")) return "Evolução de receita e lucro em relação ao período anterior.";
  return "Indicadores calculados a partir das demonstrações oficiais.";
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
  selected,
}: {
  ticker: string;
  indicator: IndicatorValue;
  years: 5 | 10;
  chartMode: ChartMode;
  selected: boolean;
}) {
  const available = hasIndicatorValue(indicator);
  const provenance = provenanceKind({ derived: indicator.derived, source: indicator.source });

  return (
    <article
      className={`${styles.card} ${selected ? styles.cardSelected : ""} ${!available ? styles.cardUnavailable : ""}`}
    >
      <div className={styles.cardHeading}>
        <span>{indicator.label}</span>
        <Link
          className={styles.help}
          href={passportHref(ticker, indicator.slug)}
          title={`${indicator.description} · Ver Data Passport`}
          aria-label={`Ver proveniência de ${indicator.label}`}
        >
          i
        </Link>
      </div>

      <div className={styles.cardValueRow}>
        <strong>{formatIndicatorValue(indicator.value, indicator.unit)}</strong>
        {!available ? <span className={styles.unavailableText}>Sem dado comparável</span> : null}
      </div>

      <div className={styles.cardFooter}>
        <div className={styles.cardBadges} aria-label="Período e origem do indicador">
          <span className={styles.metaBadge}>{yearLabel(indicator.period_end)}</span>
          <span className={`${styles.metaBadge} ${provenance === "calculated" ? styles.calculatedBadge : styles.officialBadge}`}>
            {provenanceLabel(provenance)}
          </span>
        </div>

        {indicator.supports_history ? (
          <Link
            className={styles.historyLink}
            href={historyHref(ticker, indicator.slug, years, chartMode)}
            aria-label={`Ver histórico de ${indicator.label}`}
          >
            <ChartIcon />
            Histórico
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function DataPassportPanel({
  ticker,
  passport,
}: {
  ticker: string;
  passport: IndicatorDataPassport;
}) {
  const available = passport.status === "available";
  const source = passport.source;

  return (
    <section className={styles.passportPanel} id="data-passport" aria-labelledby="data-passport-title">
      <header className={styles.passportHeader}>
        <div>
          <span className="eyebrow">DATA PASSPORT · PROVENIÊNCIA</span>
          <h2 id="data-passport-title">{passport.definition.label} · {ticker}</h2>
          <p>Metodologia, fontes e valores usados para produzir o indicador.</p>
        </div>
        <Link className={styles.closeHistory} href={`/ativos/${ticker}/indicadores`}>
          Fechar
        </Link>
      </header>

      <div className={styles.passportStats}>
        <div>
          <span>Valor</span>
          <strong>
            {available
              ? formatIndicatorValue(passport.value, passport.definition.unit)
              : "Indisponível"}
          </strong>
        </div>
        <div><span>Período</span><strong>{yearLabel(passport.period_end)}</strong></div>
        <div>
          <span>Metodologia</span>
          <strong>v{passport.definition.methodology_version}</strong>
        </div>
        <div>
          <span>Natureza</span>
          <strong>{passport.derived ? "Calculado" : "Oficial"}</strong>
        </div>
      </div>

      <div className={styles.passportMethod}>
        <div>
          <span>Definição</span>
          <p>{passport.definition.description}</p>
        </div>
        <div>
          <span>Fórmula</span>
          <code>{passport.formula ?? "Dado direto da demonstração"}</code>
        </div>
      </div>

      <div className={styles.passportSection}>
        <div className={styles.passportSectionHeading}>
          <div>
            <h3>Dados usados no cálculo</h3>
            <p>Valores efetivamente preservados pelo motor de séries para este ponto.</p>
          </div>
          <span>{passport.inputs.length} input(s)</span>
        </div>

        {passport.inputs.length ? (
          <div className={styles.passportTableWrap}>
            <table className={styles.passportTable}>
              <thead>
                <tr>
                  <th>Input</th>
                  <th>Valor</th>
                  <th>Período</th>
                  <th>Fonte</th>
                </tr>
              </thead>
              <tbody>
                {passport.inputs.map((input, index) => (
                  <tr key={`${input.metric}-${input.period_end}-${index}`}>
                    <td>
                      <strong>{input.label}</strong>
                      <small>{input.metric}</small>
                    </td>
                    <td className={input.restricted ? styles.restrictedValue : ""}>
                      {formatPassportInput(input)}
                    </td>
                    <td>{formatDate(input.period_end)}</td>
                    <td>
                      <strong>{input.source.provider}</strong>
                      <small>{input.source.source_name}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.passportEmpty}>
            {available
              ? "As fontes estão preservadas, mas este ponto não possui inputs estruturados."
              : "Não há inputs porque o indicador não pôde ser calculado para o período."}
          </div>
        )}
      </div>

      <div className={styles.passportSourceGrid}>
        <div>
          <span>Fonte do resultado</span>
          <strong>{source?.source_name ?? "—"}</strong>
          <small>{source?.provider ?? "—"}</small>
        </div>
        <div>
          <span>Data de referência</span>
          <strong>{formatDate(source?.reference_date)}</strong>
          <small>Período econômico/contábil da fonte</small>
        </div>
        <div>
          <span>Coletado em</span>
          <strong>{formatDateTime(passport.collected_at)}</strong>
          <small>Coleta mais recente entre os fatos-base usados</small>
        </div>
        <div>
          <span>Qualidade</span>
          <strong>{source?.quality ?? "—"}</strong>
          <small>Classificação da fonte do resultado</small>
        </div>
        <div>
          <span>Licença</span>
          <strong>{source?.license.license_id ?? "—"}</strong>
          <small>{passport.redistribution_scope ?? source?.license.redistribution ?? "—"}</small>
        </div>
      </div>

      {source?.source_url ? (
        <a
          className={styles.passportSourceLink}
          href={source.source_url}
          target="_blank"
          rel="noreferrer"
        >
          Abrir fonte de origem ↗
        </a>
      ) : null}

      {passport.warnings.length ? (
        <div className={styles.passportWarnings}>
          {passport.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      ) : null}
    </section>
  );
}

function HistoricalChart({ history, mode }: { history: IndicatorHistory; mode: ChartMode }) {
  const values = history.points.map((point) => Number(point.value)).filter(Number.isFinite);
  if (!values.length) {
    return <div className={styles.emptyChart}>Não há histórico suficiente para este indicador.</div>;
  }

  const width = 920;
  const height = 260;
  const left = 64;
  const right = 28;
  const top = 24;
  const bottom = 40;
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
  const x = (index: number) => left + ((index + 0.5) / history.points.length) * plotWidth;
  const zeroY = y(0);
  const gridValues = Array.from({ length: 5 }, (_, index) => max - ((max - min) * index) / 4);
  const average = history.historical_average == null ? null : Number(history.historical_average);
  const linePoints = history.points
    .map((point, index) => `${x(index).toFixed(2)},${y(Number(point.value)).toFixed(2)}`)
    .join(" ");
  const barWidth = Math.min(56, Math.max(18, plotWidth / Math.max(history.points.length * 1.8, 1)));

  return (
    <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Histórico de ${history.definition.label}`}>
      {gridValues.map((gridValue) => {
        const gridY = y(gridValue);
        return (
          <g key={gridValue.toFixed(6)}>
            <line className={styles.gridLine} x1={left} y1={gridY} x2={width - right} y2={gridY} />
            <text className={styles.axisLabel} x={left - 9} y={gridY + 4} textAnchor="end">
              {formatChartValue(gridValue, history.definition.unit)}
            </text>
          </g>
        );
      })}

      {mode === "bar" ? <line className={styles.zeroLine} x1={left} y1={zeroY} x2={width - right} y2={zeroY} /> : null}

      {average != null && Number.isFinite(average) ? (
        <g>
          <line className={styles.averageLine} x1={left} y1={y(average)} x2={width - right} y2={y(average)} />
          <text className={styles.averageLabel} x={width - right} y={y(average) - 7} textAnchor="end">
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
                rx="3"
              />
              <text
                className={styles.valueLabel}
                x={x(index)}
                y={value >= 0 ? rectY - 7 : rectY + rectHeight + 14}
                textAnchor="middle"
              >
                {formatChartValue(value, history.definition.unit)}
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
        <text className={styles.xLabel} x={x(index)} y={height - 13} textAnchor="middle" key={`x-${point.period_end}`}>
          {yearLabel(point.period_end)}
        </text>
      ))}
    </svg>
  );
}

function HistoryPanel({
  ticker,
  summary,
  history,
  years,
  chartMode,
}: {
  ticker: string;
  summary: IndicatorSummary;
  history: IndicatorHistory;
  years: 5 | 10;
  chartMode: ChartMode;
}) {
  const allIndicators = summary.groups.flatMap((group) => group.indicators).filter((indicator) => indicator.supports_history);

  return (
    <section className={styles.historyPanel} id="indicator-history" aria-labelledby="indicator-history-title">
      <header className={styles.historyHeader}>
        <div>
          <span className="eyebrow">HISTÓRICO DE INDICADORES</span>
          <h2 id="indicator-history-title">{history.definition.label} · {ticker}</h2>
          <p>Compare a evolução do fundamento ao longo do tempo sem sair da aba de indicadores.</p>
        </div>
        <Link className={styles.closeHistory} href={`/ativos/${ticker}/indicadores`}>Fechar histórico</Link>
      </header>

      <div className={styles.historyToolbar}>
        <form className={styles.indicatorSelector} method="get" action={`/ativos/${ticker}/indicadores`}>
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
          <button type="submit">Atualizar</button>
        </form>

        <div className={styles.toolbarToggles}>
          <div className={styles.toggleGroup} aria-label="Janela histórica">
            {([5, 10] as const).map((window) => (
              <Link
                className={years === window ? styles.activeToggle : ""}
                href={historyHref(ticker, history.definition.slug, window, chartMode)}
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
                href={historyHref(ticker, history.definition.slug, years, mode)}
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
        <div><span>Média histórica</span><strong>{formatIndicatorValue(history.historical_average, history.definition.unit)}</strong></div>
        <div><span>Período atual</span><strong>{yearLabel(history.current_period)}</strong></div>
      </div>

      <div className={styles.chartSurface}>
        <HistoricalChart history={history} mode={chartMode} />
      </div>

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

      <footer className={styles.historyFooter}>
        <div><span>Definição</span><p>{history.definition.description}</p></div>
        <div><span>Fórmula</span><p>{history.definition.formula ?? "Dado direto da demonstração"}</p></div>
        <div><span>Fonte</span><p>CVM · proveniência preservada em cada ponto</p></div>
      </footer>
    </section>
  );
}

export function IndicatorDashboard({
  ticker,
  summary,
  history,
  selectedSlug,
  years,
  chartMode,
  passport,
  passportSlug,
}: Props) {
  const allIndicators = summary.groups.flatMap((group) => group.indicators);
  const availableIndicators = allIndicators.filter(hasIndicatorValue).length;

  return (
    <section className={styles.section} id="indicadores-fundamentais">
      <div className={styles.sectionHeading}>
        <div>
          <span className="eyebrow">FUNDAMENTOS</span>
          <h2>Indicadores fundamentalistas {ticker}</h2>
          <p>Organizados por categoria, com histórico e metodologia rastreáveis.</p>
        </div>
        <div className={styles.headingMeta}>
          <span className={styles.sourceBadge}>{provenanceLabel("official")} + {provenanceLabel("calculated")}</span>
          <small>{availableIndicators} de {allIndicators.length} indicadores com dado · CVM anual</small>
        </div>
      </div>

      <div className={styles.groups}>
        {summary.groups.map((group) => {
          const availableInGroup = group.indicators.filter(hasIndicatorValue).length;
          return (
            <section className={styles.group} key={group.group}>
              <div className={styles.groupHeader}>
                <div>
                  <h3>{group.label}</h3>
                  <p>{groupDescription(group.label)}</p>
                </div>
                <span className={styles.groupCount}>{availableInGroup}/{group.indicators.length} com dado</span>
              </div>
              <div className={styles.grid}>
                {group.indicators.map((indicator) => (
                  <IndicatorCard
                    ticker={ticker}
                    indicator={indicator}
                    years={years}
                    chartMode={chartMode}
                    selected={selectedSlug === indicator.slug}
                    key={indicator.slug}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {passport && passportSlug ? (
        <DataPassportPanel ticker={ticker} passport={passport} />
      ) : null}

      <div className={styles.methodologyNote}>
        <strong>Metodologia aberta</strong>
        <p>
          Cada indicador preserva período, fórmula e origem. Múltiplos dependentes de cotação, como P/L, P/VP,
          EV/EBITDA e DY, continuam indisponíveis até existir uma fonte de preços adequada.
        </p>
      </div>

      {history && selectedSlug ? (
        <HistoryPanel ticker={ticker} summary={summary} history={history} years={years} chartMode={chartMode} />
      ) : null}
    </section>
  );
}
