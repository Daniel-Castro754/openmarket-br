import Link from "next/link";

import {
  getDocuments,
  getFinancialSeries,
  getIndicatorSummary,
  type FinancialMetric,
  type FinancialSeries,
} from "../../../lib/api";
import { AssetSummaryStrip } from "./asset-summary-strip";

const overviewMetrics: FinancialMetric[] = [
  "revenue",
  "net_income",
  "net_margin",
  "revenue_growth_yoy",
  "net_debt",
  "operating_cash_flow",
];

function latestPoint(series?: FinancialSeries) {
  if (!series?.points.length) return null;
  return series.points[series.points.length - 1];
}

function previousPoint(series?: FinancialSeries) {
  if (!series || series.points.length < 2) return null;
  return series.points[series.points.length - 2];
}

function metricSeries(series: FinancialSeries[], metric: FinancialMetric) {
  return series.find((item) => item.metric === metric);
}

function formatSeriesValue(series?: FinancialSeries) {
  const point = latestPoint(series);
  if (!series || !point) return "—";
  const numeric = Number(point.value);
  if (!Number.isFinite(numeric)) return point.value;

  if (series.unit === "percent") {
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(numeric)}%`;
  }

  if (series.unit === "multiple") {
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(numeric)}x`;
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: point.currency ?? "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(numeric);
}

function periodShort(series?: FinancialSeries) {
  const point = latestPoint(series);
  return point?.period_end.slice(0, 4) ?? "Sem período comparável";
}

function marginMovement(series?: FinancialSeries) {
  const current = latestPoint(series);
  const previous = previousPoint(series);
  if (!current || !previous) return "Sem comparação anterior";
  const delta = Number(current.value) - Number(previous.value);
  if (!Number.isFinite(delta)) return "Sem comparação anterior";
  const formatted = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    signDisplay: "always",
  }).format(delta);
  return `${formatted} p.p. vs. período anterior`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function documentTypeLabel(value: string) {
  const labels: Record<string, string> = {
    dfp: "DFP",
    itr: "ITR",
    fre: "FRE",
    material_fact: "Fato relevante",
    earnings_release: "Release",
    presentation: "Apresentação",
    annual_report: "Relatório anual",
    other: "Documento",
  };
  return labels[value] ?? value;
}

export default async function AssetOverviewPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.trim().toUpperCase();

  const [series, indicatorSummary, recentDocuments] = await Promise.all([
    Promise.all(overviewMetrics.map((metric) => getFinancialSeries(ticker, metric, "annual"))),
    getIndicatorSummary(ticker),
    getDocuments({ ticker, limit: 3 }),
  ]);

  const revenue = metricSeries(series, "revenue");
  const netIncome = metricSeries(series, "net_income");
  const netMargin = metricSeries(series, "net_margin");
  const revenueGrowth = metricSeries(series, "revenue_growth_yoy");
  const netDebt = metricSeries(series, "net_debt");
  const operatingCashFlow = metricSeries(series, "operating_cash_flow");
  const currentRatio = indicatorSummary.groups
    .flatMap((group) => group.indicators)
    .find((indicator) => indicator.slug === "current-ratio");

  const currentRatioValue = currentRatio?.value == null
    ? "—"
    : `${new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      }).format(Number(currentRatio.value))}x`;

  const summaryMetrics = [
    { label: "Receita", value: formatSeriesValue(revenue), context: periodShort(revenue), provenance: "CVM" },
    { label: "Lucro líquido", value: formatSeriesValue(netIncome), context: periodShort(netIncome), provenance: "CVM" },
    { label: "Margem líquida", value: formatSeriesValue(netMargin), context: marginMovement(netMargin), provenance: "Calculado" },
    {
      label: "Liquidez corrente",
      value: currentRatioValue,
      context: currentRatio?.period_end?.slice(0, 4) ?? "Sem dado disponível",
      provenance: "Calculado",
    },
  ];

  return (
    <>
      <AssetSummaryStrip metrics={summaryMetrics} />

      <section className="overview-dashboard" id="leitura-rapida">
        <div className="dashboard-main">
          <div className="section-title-row">
            <div>
              <span className="eyebrow">VISÃO GERAL</span>
              <h2>Leitura rápida dos fundamentos</h2>
            </div>
            <span className="data-source-pill">Base CVM</span>
          </div>

          <div className="insight-grid">
            <article className="insight-card neutral">
              <span>Crescimento da receita</span>
              <strong>{formatSeriesValue(revenueGrowth)}</strong>
              <p>Comparação anual do período mais recente disponível.</p>
            </article>
            <article className="insight-card neutral">
              <span>Margem líquida</span>
              <strong>{formatSeriesValue(netMargin)}</strong>
              <p>{marginMovement(netMargin)}.</p>
            </article>
            <article className="insight-card neutral">
              <span>Dívida líquida</span>
              <strong>{formatSeriesValue(netDebt)}</strong>
              <p>Calculada apenas quando os componentes pertencem ao mesmo fechamento.</p>
            </article>
            <article className="insight-card neutral">
              <span>Caixa operacional</span>
              <strong>{formatSeriesValue(operatingCashFlow)}</strong>
              <p>Fluxo de caixa operacional do período anual mais recente.</p>
            </article>
          </div>
        </div>

        <aside className="research-consensus-card">
          <div className="research-card-heading">
            <div>
              <span className="eyebrow">APROFUNDE A ANÁLISE</span>
              <h2>Escolha o nível de detalhe</h2>
            </div>
          </div>
          <p className="research-intro">A visão geral fica curta; os detalhes agora estão separados por área.</p>
          <div className="recommendation-scale">
            <div><span>Fundamentos</span><strong><Link href={`/ativos/${ticker}/indicadores`}>Indicadores →</Link></strong></div>
            <div><span>Demonstrações</span><strong><Link href={`/ativos/${ticker}/financeiro`}>Financeiro →</Link></strong></div>
            <div><span>Comparação</span><strong><Link href={`/comparar?tickers=${ticker}`}>Comparar →</Link></strong></div>
          </div>
          <small>Indicadores e séries preservam período, fórmula e origem dos dados.</small>
        </aside>
      </section>

      <section className="events-section" id="eventos-recentes">
        <div className="section-title-row">
          <div>
            <span className="eyebrow">PUBLICAÇÕES</span>
            <h2>Documentos recentes</h2>
          </div>
          <Link href={`/ativos/${ticker}/eventos`}>Ver eventos →</Link>
        </div>
        <div className="events-grid">
          {recentDocuments.map((document) => (
            <Link className="event-card" href={`/relatorios/${document.id}`} key={document.id}>
              <div>
                <span className="event-type">{documentTypeLabel(document.document_type)}</span>
                <span className="event-date">{formatDate(document.published_at)}</span>
              </div>
              <h3>{document.title}</h3>
              <small>{document.source.source_name}</small>
            </Link>
          ))}
          {recentDocuments.length === 0 && (
            <div className="event-empty">Nenhum documento sincronizado para este ticker.</div>
          )}
        </div>
      </section>
    </>
  );
}
