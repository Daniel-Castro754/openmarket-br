import Link from "next/link";

import {
  getDocuments,
  getFinancialSeries,
  getIndicatorSummary,
  type FinancialMetric,
  type FinancialSeries,
} from "../../../lib/api";
import { AssetComparePanel } from "./asset-compare-panel";
import { AssetSummaryStrip } from "./asset-summary-strip";
import {
  FundamentalsChecklist,
  type FundamentalsChecklistItem,
} from "./fundamentals-checklist";

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

function latestNumeric(series?: FinancialSeries) {
  const point = latestPoint(series);
  if (!point) return null;
  const numeric = Number(point.value);
  return Number.isFinite(numeric) ? numeric : null;
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

function checklistStatus(value: number | null, predicate: (number: number) => boolean): FundamentalsChecklistItem["status"] {
  if (value == null) return "unavailable";
  return predicate(value) ? "positive" : "attention";
}

export default async function AssetOverviewPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.trim().toUpperCase();

  const [series, indicatorSummary, recentDocuments] = await Promise.all([
    Promise.all(overviewMetrics.map((metric) => getFinancialSeries(ticker, metric, "annual"))),
    getIndicatorSummary(ticker),
    getDocuments({ ticker, limit: 4 }),
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

  const currentRatioNumeric = currentRatio?.value == null ? null : Number(currentRatio.value);
  const currentRatioValue = currentRatioNumeric == null || !Number.isFinite(currentRatioNumeric)
    ? "—"
    : `${new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      }).format(currentRatioNumeric)}x`;

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

  const revenueGrowthNumeric = latestNumeric(revenueGrowth);
  const netIncomeNumeric = latestNumeric(netIncome);
  const netMarginNumeric = latestNumeric(netMargin);
  const operatingCashFlowNumeric = latestNumeric(operatingCashFlow);
  const usableCurrentRatio = currentRatioNumeric != null && Number.isFinite(currentRatioNumeric)
    ? currentRatioNumeric
    : null;

  const checklistItems: FundamentalsChecklistItem[] = [
    {
      label: "Receita cresceu no último período anual",
      value: formatSeriesValue(revenueGrowth),
      detail: "Crescimento anual da receita no fechamento mais recente.",
      status: checklistStatus(revenueGrowthNumeric, (value) => value > 0),
    },
    {
      label: "Lucro líquido está positivo",
      value: formatSeriesValue(netIncome),
      detail: `Lucro líquido consolidado de ${periodShort(netIncome)}.`,
      status: checklistStatus(netIncomeNumeric, (value) => value > 0),
    },
    {
      label: "Margem líquida está positiva",
      value: formatSeriesValue(netMargin),
      detail: "Resultado líquido em relação à receita do período.",
      status: checklistStatus(netMarginNumeric, (value) => value > 0),
    },
    {
      label: "Liquidez corrente é igual ou superior a 1,00x",
      value: currentRatioValue,
      detail: "Ativo circulante dividido pelo passivo circulante compatível.",
      status: checklistStatus(usableCurrentRatio, (value) => value >= 1),
    },
    {
      label: "Caixa operacional está positivo",
      value: formatSeriesValue(operatingCashFlow),
      detail: "Fluxo de caixa das atividades operacionais no período anual mais recente.",
      status: checklistStatus(operatingCashFlowNumeric, (value) => value > 0),
    },
  ];

  return (
    <>
      <AssetSummaryStrip metrics={summaryMetrics} />

      <section className="asset-overview-intro" aria-labelledby="asset-overview-intro-title">
        <div>
          <span className="eyebrow">VISÃO GERAL</span>
          <h2 id="asset-overview-intro-title">Fundamentos em um olhar</h2>
          <p>
            Uma leitura curta dos dados anuais mais recentes. O detalhamento permanece separado nas abas de
            Indicadores, Financeiro, Eventos e Relatórios.
          </p>
        </div>
        <span>CVM · dados anuais</span>
      </section>

      <section className="asset-overview-research-grid">
        <FundamentalsChecklist items={checklistItems} />
        <AssetComparePanel ticker={ticker} />
      </section>

      <section className="asset-overview-debt-note" aria-label="Contexto de endividamento">
        <span>Dívida líquida</span>
        <strong>{formatSeriesValue(netDebt)}</strong>
        <p>Calculada apenas quando caixa e componentes da dívida pertencem ao mesmo fechamento.</p>
      </section>

      <section className="asset-analysis-shortcuts" aria-labelledby="asset-analysis-shortcuts-title">
        <div className="asset-analysis-shortcuts-header">
          <div>
            <span className="eyebrow">APROFUNDE A ANÁLISE</span>
            <h2 id="asset-analysis-shortcuts-title">Escolha a próxima leitura</h2>
          </div>
          <p>Cada área mantém período, fórmula e origem dos dados sem duplicar toda a análise nesta página.</p>
        </div>
        <nav aria-label="Áreas de análise do ativo">
          <Link href={`/ativos/${ticker}/indicadores`}>
            <strong>Indicadores</strong>
            <span>Margens, retorno, liquidez e dívida</span>
            <b>Abrir →</b>
          </Link>
          <Link href={`/ativos/${ticker}/financeiro`}>
            <strong>Financeiro</strong>
            <span>Resultados, balanço e fluxo de caixa</span>
            <b>Abrir →</b>
          </Link>
          <Link href={`/ativos/${ticker}/eventos`}>
            <strong>Eventos</strong>
            <span>Fatos, ITR, DFP e publicações recentes</span>
            <b>Abrir →</b>
          </Link>
          <Link href={`/ativos/${ticker}/relatorios`}>
            <strong>Relatórios</strong>
            <span>Documentos oficiais no Document Hub</span>
            <b>Abrir →</b>
          </Link>
        </nav>
      </section>

      <section className="asset-publications" id="eventos-recentes" aria-labelledby="asset-publications-title">
        <div className="section-title-row">
          <div>
            <span className="eyebrow">PUBLICAÇÕES</span>
            <h2 id="asset-publications-title">Documentos recentes</h2>
          </div>
          <Link href={`/ativos/${ticker}/eventos`}>Ver todos →</Link>
        </div>

        {recentDocuments.length > 0 ? (
          <div className="asset-publications-list">
            {recentDocuments.map((document) => (
              <Link className="asset-publication-row" href={`/relatorios/${document.id}`} key={document.id}>
                <div className="asset-publication-meta">
                  <strong>{documentTypeLabel(document.document_type)}</strong>
                  <span>{formatDate(document.published_at)}</span>
                </div>
                <div className="asset-publication-copy">
                  <strong>{document.title}</strong>
                  <span>{document.reference_period ? `Referência: ${document.reference_period}` : "Período não informado"}</span>
                </div>
                <span className="asset-publication-source">{document.source.source_name}</span>
                <span className="asset-publication-arrow" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="asset-publications-empty">Nenhum documento sincronizado para este ticker.</p>
        )}
      </section>
    </>
  );
}
