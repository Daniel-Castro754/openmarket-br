import Link from "next/link";
import { notFound } from "next/navigation";

import { FinancialBarChart } from "../../../components/financial-bar-chart";
import {
  getAsset,
  getFinancialSeries,
  type FinancialMetric,
  type SeriesFrequency,
  type SourceMetadata,
} from "../../../lib/api";

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

const analyticsMetrics: FinancialMetric[] = [
  "gross_margin",
  "operating_margin",
  "net_margin",
  "revenue_growth_yoy",
];

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function sourceLabel(source?: SourceMetadata | null) {
  if (!source) return "Fonte não informada";
  const date = source.reference_date ? ` • ${formatDate(source.reference_date)}` : "";
  return `${source.source_name}${date}`;
}

export default async function AssetPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const [{ ticker: rawTicker }, query] = await Promise.all([params, searchParams]);
  const ticker = rawTicker.trim().toUpperCase();
  const requestedView = Array.isArray(query.view) ? query.view[0] : query.view;
  const frequency: SeriesFrequency = requestedView === "quarterly" ? "quarterly" : "annual";
  const isQuarterly = frequency === "quarterly";
  const analysisMetrics: FinancialMetric[] = isQuarterly
    ? analyticsMetrics
    : [...analyticsMetrics, "roe"];
  const asset = await getAsset(ticker);

  if (!asset) notFound();

  const [fundamentalSeries, capitalSeries, analyticsSeries] = await Promise.all([
    Promise.all(
      fundamentalMetrics.map((metric) => getFinancialSeries(ticker, metric, frequency)),
    ),
    Promise.all(
      capitalMetrics.map((metric) => getFinancialSeries(ticker, metric, frequency)),
    ),
    Promise.all(
      analysisMetrics.map((metric) => getFinancialSeries(ticker, metric, frequency)),
    ),
  ]);
  const { instrument, company } = asset;
  const title = company?.trading_name || company?.legal_name || instrument.issuer_name || ticker;

  return (
    <main className="asset-page">
      <nav className="asset-nav">
        <Link href="/">← OpenMarket BR</Link>
        <span>Mercado / Ativos / {ticker}</span>
      </nav>

      <header className="asset-header">
        <div>
          <span className="ticker-pill">{instrument.exchange} · {instrument.ticker}</span>
          <h1>{title}</h1>
          <p>{company?.legal_name ?? instrument.issuer_name ?? "Emissor ainda não identificado."}</p>
        </div>
        <div className="source-badge">
          <span>Fonte do instrumento</span>
          <strong>{sourceLabel(instrument.source)}</strong>
        </div>
      </header>

      <section className="metric-grid" aria-label="Identificação do ativo">
        <article className="metric-card">
          <span>Tipo</span>
          <strong>{instrument.instrument_type.toUpperCase()}</strong>
          <small>{instrument.specification ?? instrument.security_category ?? "—"}</small>
        </article>
        <article className="metric-card">
          <span>ISIN</span>
          <strong>{instrument.isin ?? "—"}</strong>
          <small>Identificador internacional</small>
        </article>
        <article className="metric-card">
          <span>Código CVM</span>
          <strong>{company?.cvm_code ?? "—"}</strong>
          <small>{company ? "Companhia vinculada" : "Vínculo pendente"}</small>
        </article>
        <article className="metric-card">
          <span>Governança</span>
          <strong>{instrument.governance_level ?? "—"}</strong>
          <small>B3</small>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel financial-coverage">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">COBERTURA FINANCEIRA</span>
              <h2>Dados CVM disponíveis</h2>
            </div>
            <strong className="coverage-count">{asset.financial_item_count.toLocaleString("pt-BR")}</strong>
          </div>
          <div className="coverage-row">
            <div>
              <span>Último período</span>
              <strong>{formatDate(asset.latest_period)}</strong>
            </div>
            <div>
              <span>Períodos carregados</span>
              <strong>{asset.available_periods.length}</strong>
            </div>
          </div>
          <div className="period-list">
            {asset.available_periods.slice(0, 12).map((period) => (
              <span key={period}>{formatDate(period)}</span>
            ))}
            {asset.available_periods.length === 0 && <span>Nenhum demonstrativo sincronizado.</span>}
          </div>
        </article>

        <article className="panel identity-panel">
          <span className="eyebrow">IDENTIFICAÇÃO</span>
          <h2>Companhia</h2>
          <dl>
            <div><dt>CNPJ</dt><dd>{company?.cnpj ?? "—"}</dd></div>
            <div><dt>Moeda</dt><dd>{instrument.currency}</dd></div>
            <div><dt>Bolsa</dt><dd>{instrument.exchange}</dd></div>
            <div><dt>Categoria</dt><dd>{instrument.security_category ?? "—"}</dd></div>
          </dl>
        </article>
      </section>

      <section className="series-section">
        <div className="section-heading series-section-heading">
          <div>
            <span className="eyebrow">DEMONSTRAÇÕES FINANCEIRAS</span>
            <h2>{isQuarterly ? "Histórico trimestral" : "Histórico anual"}</h2>
          </div>
          <div className="series-heading-side">
            <div className="series-toggle" aria-label="Frequência das séries">
              <Link className={!isQuarterly ? "active" : ""} href={`/ativos/${ticker}`}>
                Anual
              </Link>
              <Link
                className={isQuarterly ? "active" : ""}
                href={`/ativos/${ticker}?view=quarterly`}
              >
                Trimestral
              </Link>
            </div>
            <p>
              {isQuarterly
                ? "Fluxos usam trimestres isolados do ITR. O 4T é calculado como DFP anual menos ITR de 9M e aparece marcado com D, mantendo a fórmula e as fontes de entrada."
                : "DFP consolidada da CVM. Em reapresentações, a visualização usa a versão mais recente e preserva o histórico no banco."}
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
            Caixa, empréstimos de curto e longo prazo usam contas padronizadas da CVM. Dívida bruta
            e líquida só são calculadas quando os componentes pertencem ao mesmo fechamento.
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
            <span className="eyebrow">ANÁLISE</span>
            <h2>{isQuarterly ? "Margens e crescimento" : "Margens, crescimento e retorno"}</h2>
          </div>
          <p>
            Indicadores calculados sobre fatos oficiais compatíveis da CVM. O ROE anual usa lucro
            líquido consolidado e patrimônio líquido médio; nenhum ROE trimestral é anualizado implicitamente.
          </p>
        </div>
        <div className="series-grid">
          {analyticsSeries.map((item) => (
            <FinancialBarChart key={`${item.metric}-${frequency}`} series={item} />
          ))}
        </div>
      </section>

      <section className="panel roadmap-panel">
        <div>
          <span className="eyebrow">PRÓXIMO BLOCO</span>
          <h2>Fluxo de caixa e geração de valor</h2>
          <p>
            O próximo passo será mapear fluxo de caixa operacional, investimentos e CAPEX para chegar
            a fluxo de caixa livre somente onde a estrutura CVM permitir uma derivação auditável.
          </p>
        </div>
        <span className="text-link">Em desenvolvimento</span>
      </section>

      <footer className="asset-sources">
        <strong>Proveniência</strong>
        <span>{sourceLabel(instrument.source)}</span>
        {company?.source && <span>{sourceLabel(company.source)}</span>}
      </footer>
    </main>
  );
}
