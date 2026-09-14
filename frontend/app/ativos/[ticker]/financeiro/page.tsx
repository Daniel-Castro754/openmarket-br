import Link from "next/link";

import { FinancialBarChart } from "../../../../components/financial-bar-chart";
import {
  getFinancialSeries,
  type FinancialMetric,
  type SeriesFrequency,
} from "../../../../lib/api";

const fundamentalMetrics: FinancialMetric[] = [
  "revenue",
  "gross_profit",
  "operating_result",
  "net_income",
  "total_assets",
  "equity",
];

const capitalMetrics: FinancialMetric[] = [
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

  const [fundamentalSeries, capitalSeries, cashFlowSeries, analyticsSeries] = await Promise.all([
    Promise.all(fundamentalMetrics.map((metric) => getFinancialSeries(ticker, metric, frequency))),
    Promise.all(capitalMetrics.map((metric) => getFinancialSeries(ticker, metric, frequency))),
    Promise.all(cashFlowMetrics.map((metric) => getFinancialSeries(ticker, metric, frequency))),
    Promise.all(analysisMetrics.map((metric) => getFinancialSeries(ticker, metric, frequency))),
  ]);

  return (
    <>
      <section className="series-section" id="financeiro">
        <div className="section-heading series-section-heading">
          <div>
            <span className="eyebrow">DEMONSTRAÇÕES FINANCEIRAS</span>
            <h2>{isQuarterly ? "Histórico trimestral" : "Histórico anual"}</h2>
          </div>
          <div className="series-heading-side">
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
            <p>
              {isQuarterly
                ? "Fluxos usam trimestres isolados do ITR. O 4T é calculado como DFP anual menos ITR de 9M e aparece marcado com D."
                : "DFP consolidada da CVM. Em reapresentações, usamos a versão mais recente e preservamos o histórico no banco."}
            </p>
          </div>
        </div>
        <div className="series-grid">
          {fundamentalSeries.map((item) => (
            <FinancialBarChart key={`${item.metric}-${frequency}`} series={item} />
          ))}
        </div>
      </section>

      <section className="series-section analytics-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">LIQUIDEZ E ENDIVIDAMENTO</span>
            <h2>Caixa e estrutura da dívida</h2>
          </div>
          <p>
            Caixa, empréstimos de curto e longo prazo usam contas padronizadas da CVM. Dívida bruta e líquida só
            são calculadas quando os componentes pertencem ao mesmo fechamento.
          </p>
        </div>
        <div className="series-grid">
          {capitalSeries.map((item) => (
            <FinancialBarChart key={`${item.metric}-${frequency}`} series={item} />
          ))}
        </div>
      </section>

      <section className="series-section analytics-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FLUXO DE CAIXA</span>
            <h2>Geração e uso de caixa</h2>
          </div>
          <p>
            A DFC usa os totais padronizados 6.01, 6.02, 6.03 e 6.05. Na visão trimestral, acumulados sucessivos
            são isolados e mantêm proveniência explícita.
          </p>
        </div>
        <div className="series-grid">
          {cashFlowSeries.map((item) => (
            <FinancialBarChart key={`${item.metric}-${frequency}`} series={item} />
          ))}
        </div>
      </section>

      <section className="series-section analytics-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ANÁLISE</span>
            <h2>{isQuarterly ? "Margens e crescimento" : "Margens, crescimento e retorno"}</h2>
          </div>
          <p>
            Indicadores calculados sobre fatos oficiais compatíveis da CVM. O ROE anual usa lucro líquido
            consolidado e patrimônio líquido médio; nenhum ROE trimestral é anualizado implicitamente.
          </p>
        </div>
        <div className="series-grid">
          {analyticsSeries.map((item) => (
            <FinancialBarChart key={`${item.metric}-${frequency}`} series={item} />
          ))}
        </div>
      </section>
    </>
  );
}
