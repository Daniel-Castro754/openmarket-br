import Link from "next/link";

import { FinancialBarChart } from "../../../../components/financial-bar-chart";
import {
  getFinancialSeries,
  type FinancialMetric,
  type FinancialSeries,
  type SeriesFrequency,
} from "../../../../lib/api";

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
  const numeric = Number(point.value);
  if (!Number.isFinite(numeric)) return point.value;

  if (series.unit === "percent") {
    return `${new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    }).format(numeric)}%`;
  }

  if (series.unit === "multiple") {
    return `${new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(numeric)}x`;
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: point.currency ?? "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(numeric);
}

function periodLabel(series?: FinancialSeries) {
  const point = latestPoint(series);
  if (!point) return "Sem período";
  const [year, month] = point.period_end.split("-").map(Number);
  if (series?.frequency === "quarterly") {
    return `${Math.max(1, Math.min(4, Math.ceil(month / 3)))}T${String(year).slice(-2)}`;
  }
  return String(year);
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
    { label: "Receita", value: formatSeriesValue(revenue), period: periodLabel(revenue), source: "CVM" },
    { label: "Lucro líquido", value: formatSeriesValue(netIncome), period: periodLabel(netIncome), source: "CVM" },
    { label: "Caixa", value: formatSeriesValue(cash), period: periodLabel(cash), source: "CVM" },
    { label: "Dívida líquida", value: formatSeriesValue(netDebt), period: periodLabel(netDebt), source: "Calculado" },
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
