import Link from "next/link";

import { FinancialBarChart } from "../../../../components/financial-bar-chart";
import {
  getFinancialSeries,
  type FinancialMetric,
  type FinancialSeries,
  type SeriesFrequency,
} from "../../../../lib/api";
import { provenanceKind, provenanceLabel } from "../../../../lib/data-semantics";
import { formatFinancialValue, formatPeriod } from "../../../../lib/format";

const incomeMetrics: FinancialMetric[] = [
  "revenue",
  "gross_profit",
  "operating_result",
  "net_income",
];

const balanceMetrics: FinancialMetric[] = [
  "total_assets",
  "equity",
  "cash",
  "short_term_debt",
  "long_term_debt",
  "gross_debt",
  "net_debt",
];

const cashFlowMetrics: FinancialMetric[] = [
  "operating_cash_flow",
  "investing_cash_flow",
  "financing_cash_flow",
  "net_change_in_cash",
];

const analyticsMetrics: FinancialMetric[] = [
  "gross_margin",
  "operating_margin",
  "net_margin",
  "revenue_growth_yoy",
];

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function latestPoint(series?: FinancialSeries) {
  if (!series?.points.length) return null;
  return series.points[series.points.length - 1];
}

function metricSeries(series: FinancialSeries[], metric: FinancialMetric) {
  return series.find((item) => item.metric === metric);
}

function formatSeriesValue(series?: FinancialSeries) {
  const point = latestPoint(series);
  if (!series || !point) return "—";
  return formatFinancialValue(point.value, series.unit, {
    currency: point.currency,
    percentDigits: 1,
  });
}

function periodLabel(series?: FinancialSeries) {
  const point = latestPoint(series);
  if (!series || !point) return "Sem período";
  return formatPeriod(point.period_end, series.frequency);
}

function seriesProvenance(series?: FinancialSeries) {
  const point = latestPoint(series);
  return provenanceLabel(provenanceKind({
    derived: Boolean(series?.formula) || Boolean(point?.derived),
    source: point?.source,
  }));
}

export default async function AssetFinancialPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const [{ ticker: rawTicker }, query] = await Promise.all([params, searchParams]);
  const ticker = rawTicker.trim().toUpperCase();
  const frequency: SeriesFrequency = firstValue(query.view) === "quarterly" ? "quarterly" : "annual";
  const isQuarterly = frequency === "quarterly";
  const analysisMetrics: FinancialMetric[] = isQuarterly
    ? analyticsMetrics
    : [...analyticsMetrics, "roe"];

  const [incomeSeries, balanceSeries, cashFlowSeries, analyticsSeries] = await Promise.all([
    Promise.all(incomeMetrics.map((metric) => getFinancialSeries(ticker, metric, frequency))),
    Promise.all(balanceMetrics.map((metric) => getFinancialSeries(ticker, metric, frequency))),
    Promise.all(cashFlowMetrics.map((metric) => getFinancialSeries(ticker, metric, frequency))),
    Promise.all(analysisMetrics.map((metric) => getFinancialSeries(ticker, metric, frequency))),
  ]);

  const revenue = metricSeries(incomeSeries, "revenue");
  const netIncome = metricSeries(incomeSeries, "net_income");
  const cash = metricSeries(balanceSeries, "cash");
  const netDebt = metricSeries(balanceSeries, "net_debt");

  const headlineMetrics = [
    { label: "Receita", value: formatSeriesValue(revenue), period: periodLabel(revenue), source: seriesProvenance(revenue) },
    { label: "Lucro líquido", value: formatSeriesValue(netIncome), period: periodLabel(netIncome), source: seriesProvenance(netIncome) },
    { label: "Caixa", value: formatSeriesValue(cash), period: periodLabel(cash), source: seriesProvenance(cash) },
    { label: "Dívida líquida", value: formatSeriesValue(netDebt), period: periodLabel(netDebt), source: seriesProvenance(netDebt) },
  ];

  return (
    <div className={`financial-workspace ${isQuarterly ? "financial-view-quarterly" : "financial-view-annual"}`}>
      <section className="financial-workspace-header">
        <div className="financial-workspace-copy">
          <span className="eyebrow">FINANCEIRO</span>
          <h2>Demonstrações e evolução financeira</h2>
          <p>
            Resultado, balanço, caixa e indicadores calculados com período, conta de origem e proveniência preservados.
          </p>
        </div>

        <div className="financial-workspace-controls">
          <span>Frequência</span>
          <div className="series-toggle" aria-label="Frequência das séries">
            <Link className={!isQuarterly ? "active" : ""} href={`/ativos/${ticker}/financeiro`}>
              Anual
            </Link>
            <Link
              className={isQuarterly ? "active" : ""}
              href={`/ativos/${ticker}/financeiro?view=quarterly`}
            >
              Trimestral
            </Link>
          </div>
        </div>
      </section>

      <section className="financial-headline-strip" aria-label="Resumo financeiro">
        {headlineMetrics.map((metric) => (
          <article key={metric.label}>
            <div>
              <span>{metric.label}</span>
              <small>{metric.source}</small>
            </div>
            <strong>{metric.value}</strong>
            <p>{metric.period}</p>
          </article>
        ))}
      </section>

      <nav className="financial-section-nav" aria-label="Áreas do financeiro">
        <a href="#resultado">Resultados</a>
        <a href="#balanco">Balanço</a>
        <a href="#caixa">Fluxo de caixa</a>
        <a href="#analise-financeira">Indicadores</a>
      </nav>

      <section className="series-section financial-research-section" id="resultado">
        <div className="section-heading series-section-heading">
          <div>
            <span className="eyebrow">RESULTADO</span>
            <h2>{isQuarterly ? "Receitas e lucros trimestrais" : "Receitas e lucros anuais"}</h2>
          </div>
          <p>Receita, lucro bruto, resultado operacional e lucro líquido da DRE.</p>
        </div>
        <div className="series-grid financial-result-grid">
          {incomeSeries.map((item) => (
            <FinancialBarChart key={`${item.metric}-${frequency}`} series={item} />
          ))}
        </div>
      </section>

      <section className="series-section financial-research-section" id="balanco">
        <div className="section-heading">
          <div>
            <span className="eyebrow">BALANÇO PATRIMONIAL</span>
            <h2>Ativos, patrimônio e endividamento</h2>
          </div>
          <p>Caixa e dívida usam contas CVM compatíveis do mesmo fechamento.</p>
        </div>
        <div className="series-grid">
          {balanceSeries.map((item) => (
            <FinancialBarChart key={`${item.metric}-${frequency}`} series={item} />
          ))}
        </div>
      </section>

      <section className="series-section financial-research-section" id="caixa">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FLUXO DE CAIXA</span>
            <h2>Geração, investimento e financiamento</h2>
          </div>
          <p>DFC padronizada; trimestres derivados mantêm proveniência explícita.</p>
        </div>
        <div className="series-grid financial-result-grid">
          {cashFlowSeries.map((item) => (
            <FinancialBarChart key={`${item.metric}-${frequency}`} series={item} />
          ))}
        </div>
      </section>

      <section className="series-section financial-research-section" id="analise-financeira">
        <div className="section-heading">
          <div>
            <span className="eyebrow">INDICADORES FINANCEIROS</span>
            <h2>{isQuarterly ? "Margens e crescimento" : "Margens, crescimento e retorno"}</h2>
          </div>
          <p>Indicadores calculados apenas sobre fatos oficiais compatíveis da CVM.</p>
        </div>
        <div className="series-grid">
          {analyticsSeries.map((item) => (
            <FinancialBarChart key={`${item.metric}-${frequency}`} series={item} />
          ))}
        </div>
      </section>

      <div className="financial-method-note">
        <strong>Leitura dos dados</strong>
        <p>
          {isQuarterly
            ? "Fluxos usam trimestres isolados do ITR. O 4T é calculado como DFP anual menos ITR de 9M e aparece marcado com D."
            : "DFP consolidada da CVM. Em reapresentações, a versão mais recente é usada na leitura atual, preservando o histórico no banco."}
        </p>
      </div>
    </div>
  );
}
