import Link from "next/link";

import {
  getPerformanceRisk,
  type PerformancePoint,
  type PerformanceRiskSnapshot,
  type PerformanceWindow,
} from "../../../../lib/api";
import { DATA_EMPTY, formatDateShortPtBr, formatNumberPtBr } from "../../../../lib/format";
import styles from "./performance.module.css";

const windows: Array<{ key: PerformanceWindow; label: string }> = [
  { key: "1y", label: "1 ano" },
  { key: "3y", label: "3 anos" },
  { key: "5y", label: "5 anos" },
  { key: "max", label: "Máximo" },
];

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeWindow(value?: string): PerformanceWindow {
  return windows.some((item) => item.key === value) ? (value as PerformanceWindow) : "1y";
}

function percent(value?: string | null) {
  if (value == null) return DATA_EMPTY;
  return `${formatNumberPtBr(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function ratio(value?: string | null) {
  if (value == null) return DATA_EMPTY;
  return formatNumberPtBr(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function chartPoints(
  points: PerformancePoint[],
  accessor: (point: PerformancePoint) => number,
  width = 900,
  height = 240,
) {
  if (!points.length) return "";
  const values = points.map(accessor);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0.000001);

  return points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - ((accessor(point) - min) / span) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className={styles.metricCard}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function PerformanceCharts({ snapshot }: { snapshot: PerformanceRiskSnapshot }) {
  const priceLine = chartPoints(snapshot.points, (point) => Number(point.normalized_value));
  const drawdownLine = chartPoints(snapshot.points, (point) => Number(point.drawdown_percent));

  return (
    <div className={styles.chartGrid}>
      <section className={styles.chartPanel}>
        <header>
          <div>
            <span>PREÇO NORMALIZADO</span>
            <h2>Base 100</h2>
          </div>
          <small>{snapshot.observations} pregões</small>
        </header>
        <svg
          className={styles.chart}
          viewBox="0 0 900 240"
          role="img"
          aria-label="Curva de preço normalizada"
          preserveAspectRatio="none"
        >
          <line x1="0" y1="239" x2="900" y2="239" className={styles.axis} />
          <polyline points={priceLine} className={styles.priceLine} />
        </svg>
        <footer>
          <span>{formatDateShortPtBr(snapshot.start)}</span>
          <span>{formatDateShortPtBr(snapshot.end)}</span>
        </footer>
      </section>

      <section className={styles.chartPanel}>
        <header>
          <div>
            <span>DRAWDOWN</span>
            <h2>Queda desde o pico</h2>
          </div>
          <small>máx. {percent(snapshot.max_drawdown_percent)}</small>
        </header>
        <svg
          className={styles.chart}
          viewBox="0 0 900 240"
          role="img"
          aria-label="Curva de drawdown"
          preserveAspectRatio="none"
        >
          <line x1="0" y1="1" x2="900" y2="1" className={styles.axis} />
          <polyline points={drawdownLine} className={styles.drawdownLine} />
        </svg>
        <footer>
          <span>0% = novo pico</span>
          <span>quanto mais negativo, maior a queda</span>
        </footer>
      </section>
    </div>
  );
}

export default async function PerformancePage({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{
    window?: string | string[];
    benchmark?: string | string[];
  }>;
}) {
  const [{ ticker: rawTicker }, query] = await Promise.all([params, searchParams]);
  const ticker = rawTicker.trim().toUpperCase();
  const window = normalizeWindow(firstValue(query.window));
  const benchmark = firstValue(query.benchmark)?.trim().toUpperCase() || null;
  const snapshot = await getPerformanceRisk(ticker, window, benchmark);

  if (!snapshot) {
    return (
      <section className={styles.emptyState}>
        <span>DESEMPENHO & RISCO</span>
        <h1>Ativo não encontrado</h1>
      </section>
    );
  }

  const available = snapshot.status === "available";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className="eyebrow">PERFORMANCE & RISK · PREÇOS PERSISTIDOS</span>
          <h1>Desempenho & risco</h1>
          <p>
            Retorno de preço, volatilidade e drawdown calculados apenas sobre histórico persistido.
          </p>
        </div>
        <nav className={styles.windowTabs} aria-label="Janela de desempenho">
          {windows.map((item) => (
            <Link
              key={item.key}
              href={`/ativos/${ticker}/desempenho?window=${item.key}`}
              className={window === item.key ? styles.activeWindow : ""}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      {!available ? (
        <section className={styles.emptyState}>
          <span>HISTÓRICO INSUFICIENTE</span>
          <h2>Ainda não há preços suficientes para calcular risco.</h2>
          <p>
            Importe um arquivo oficial COTAHIST da B3 depois de sincronizar o ticker.
          </p>
          <code>
            python -m openmarket_api.cli import-cotahist {ticker} /caminho/COTAHIST.2025.TXT
          </code>
          {snapshot.warnings.map((warning) => <small key={warning}>{warning}</small>)}
        </section>
      ) : (
        <>
          <section className={styles.metricGrid} aria-label="Métricas de desempenho e risco">
            <MetricCard label="Retorno acumulado" value={percent(snapshot.total_return_percent)} hint="Preço final ÷ inicial − 1" />
            <MetricCard label="CAGR" value={percent(snapshot.cagr_percent)} hint="Retorno anualizado geométrico" />
            <MetricCard label="Volatilidade" value={percent(snapshot.annualized_volatility_percent)} hint="Desvio diário anualizado · 252 pregões" />
            <MetricCard label="Drawdown máximo" value={percent(snapshot.max_drawdown_percent)} hint="Maior queda desde um pico anterior" />
            <MetricCard label="Sharpe" value={ratio(snapshot.sharpe_ratio)} hint={`Risk-free: ${percent(snapshot.risk_free_rate_annual_percent)} a.a.`} />
            <MetricCard label="Sortino" value={ratio(snapshot.sortino_ratio)} hint="Penaliza apenas retornos abaixo do alvo" />
            <MetricCard label="Calmar" value={ratio(snapshot.calmar_ratio)} hint="CAGR ÷ drawdown máximo" />
            <MetricCard label="Melhor / pior dia" value={`${percent(snapshot.best_day_percent)} / ${percent(snapshot.worst_day_percent)}`} hint="Retornos entre fechamentos consecutivos" />
          </section>

          <PerformanceCharts snapshot={snapshot} />

          {snapshot.benchmark ? (
            <section className={styles.benchmarkPanel}>
              <div>
                <span>BENCHMARK PERSISTIDO</span>
                <h2>{snapshot.benchmark.ticker}</h2>
              </div>
              <div>
                <span>Retorno</span>
                <strong>{percent(snapshot.benchmark.total_return_percent)}</strong>
              </div>
              <div>
                <span>CAGR</span>
                <strong>{percent(snapshot.benchmark.cagr_percent)}</strong>
              </div>
              <div>
                <span>Volatilidade</span>
                <strong>{percent(snapshot.benchmark.annualized_volatility_percent)}</strong>
              </div>
              <div>
                <span>Drawdown</span>
                <strong>{percent(snapshot.benchmark.max_drawdown_percent)}</strong>
              </div>
            </section>
          ) : null}
        </>
      )}

      <section className={styles.methodology}>
        <div>
          <span>METODOLOGIA</span>
          <h2>Retorno de preço, não retorno total</h2>
          <p>
            A série COTAHIST da B3 não é ajustada por inflação, dividendos, bonificações ou outros
            proventos. As métricas desta página devem ser lidas como comportamento do preço de
            fechamento.
          </p>
        </div>
        <dl>
          <div><dt>Período</dt><dd>{formatDateShortPtBr(snapshot.start)} — {formatDateShortPtBr(snapshot.end)}</dd></div>
          <div><dt>Observações</dt><dd>{snapshot.observations.toLocaleString("pt-BR")}</dd></div>
          <div><dt>Base de preço</dt><dd>{snapshot.price_basis}</dd></div>
          <div><dt>Fonte</dt><dd>{snapshot.source?.source_name ?? DATA_EMPTY}</dd></div>
          <div><dt>Qualidade</dt><dd>{snapshot.source?.quality ?? DATA_EMPTY}</dd></div>
          <div><dt>Licença</dt><dd>{snapshot.source?.license.license_id ?? DATA_EMPTY}</dd></div>
        </dl>
        {snapshot.source?.source_url ? (
          <a href={snapshot.source.source_url} target="_blank" rel="noreferrer">
            Abrir referência da fonte ↗
          </a>
        ) : null}
        <div className={styles.warnings}>
          {snapshot.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      </section>
    </div>
  );
}
