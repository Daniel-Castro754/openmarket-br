import Link from "next/link";
import { notFound } from "next/navigation";

import { FinancialBarChart } from "../../../components/financial-bar-chart";
import {
  getAsset,
  getDocuments,
  getFinancialSeries,
  getIndicatorHistory,
  getIndicatorSummary,
  type FinancialMetric,
  type FinancialSeries,
  type SeriesFrequency,
  type SourceMetadata,
} from "../../../lib/api";
import { IndicatorDashboard } from "./indicator-dashboard";

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

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: point.currency ?? "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(numeric);
}

function periodShort(series?: FinancialSeries) {
  const point = latestPoint(series);
  if (!point) return "Sem período comparável";
  const [year, month] = point.period_end.split("-").map(Number);
  if (series?.frequency === "quarterly") {
    return `${Math.max(1, Math.min(4, Math.ceil(month / 3)))}T${String(year).slice(-2)}`;
  }
  return String(year);
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

function insightTone(value: number) {
  if (value > 0) return "positive";
  if (value < 0) return "attention";
  return "neutral";
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

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AssetPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{
    view?: string | string[];
    indicator?: string | string[];
    years?: string | string[];
    chart?: string | string[];
  }>;
}) {
  const [{ ticker: rawTicker }, query] = await Promise.all([params, searchParams]);
  const ticker = rawTicker.trim().toUpperCase();
  const requestedView = firstValue(query.view);
  const frequency: SeriesFrequency = requestedView === "quarterly" ? "quarterly" : "annual";
  const isQuarterly = frequency === "quarterly";
  const requestedIndicator = firstValue(query.indicator)?.trim().toLowerCase() || null;
  const indicatorYears = firstValue(query.years) === "10" ? 10 : 5;
  const indicatorChart = firstValue(query.chart) === "line" ? "line" : "bar";
  const analysisMetrics: FinancialMetric[] = isQuarterly
    ? analyticsMetrics
    : [...analyticsMetrics, "roe"];
  const asset = await getAsset(ticker);

  if (!asset) notFound();

  const [
    fundamentalSeries,
    capitalSeries,
    cashFlowSeries,
    analyticsSeries,
    recentDocuments,
    indicatorSummary,
    indicatorHistory,
  ] = await Promise.all([
    Promise.all(fundamentalMetrics.map((metric) => getFinancialSeries(ticker, metric, frequency))),
    Promise.all(capitalMetrics.map((metric) => getFinancialSeries(ticker, metric, frequency))),
    Promise.all(cashFlowMetrics.map((metric) => getFinancialSeries(ticker, metric, frequency))),
    Promise.all(analysisMetrics.map((metric) => getFinancialSeries(ticker, metric, frequency))),
    getDocuments({ ticker, limit: 4 }),
    getIndicatorSummary(ticker),
    requestedIndicator
      ? getIndicatorHistory(ticker, requestedIndicator, indicatorYears)
      : Promise.resolve(null),
  ]);

  const { instrument, company } = asset;
  const title = company?.trading_name || company?.legal_name || instrument.issuer_name || ticker;
  const revenue = metricSeries(fundamentalSeries, "revenue");
  const netIncome = metricSeries(fundamentalSeries, "net_income");
  const netMargin = metricSeries(analyticsSeries, "net_margin");
  const revenueGrowth = metricSeries(analyticsSeries, "revenue_growth_yoy");
  const roe = metricSeries(analyticsSeries, "roe");
  const netDebt = metricSeries(capitalSeries, "net_debt");
  const operatingCashFlow = metricSeries(cashFlowSeries, "operating_cash_flow");
  const growthValue = Number(latestPoint(revenueGrowth)?.value ?? 0);
  const cashFlowValue = Number(latestPoint(operatingCashFlow)?.value ?? 0);

  return (
    <main className="asset-page">
      <div className="asset-breadcrumb">
        <Link href="/">Mercado</Link>
        <span>/</span>
        <span>Ações</span>
        <span>/</span>
        <strong>{ticker}</strong>
      </div>

      <section className="asset-overview" id="visao-geral">
        <div className="asset-title-block">
          <div className="asset-symbol-mark">{ticker.slice(0, 2)}</div>
          <div>
            <div className="asset-title-row">
              <h1>{ticker}</h1>
              <span className="exchange-tag">{instrument.exchange}</span>
            </div>
            <h2>{title}</h2>
            <p>{company?.legal_name ?? instrument.issuer_name ?? "Emissor ainda não identificado."}</p>
          </div>
        </div>

        <div className="quote-placeholder">
          <span>Cotação</span>
          <strong>—</strong>
          <small>Fonte de preço ainda não integrada</small>
        </div>
      </section>

      <nav className="asset-tabs" aria-label="Seções da ação">
        <a className="active" href="#visao-geral">Visão geral</a>
        <a href="#indicadores-fundamentais">Indicadores</a>
        <a href="#financeiro">Financeiro</a>
        <a href="#eventos">Eventos</a>
        <Link href={`/relatorios?ticker=${ticker}`}>Relatórios</Link>
      </nav>

      <section className="headline-metrics" aria-label="Indicadores em destaque">
        <article>
          <span>Receita</span>
          <strong>{formatSeriesValue(revenue)}</strong>
          <small>{periodShort(revenue)}</small>
        </article>
        <article>
          <span>Lucro líquido</span>
          <strong>{formatSeriesValue(netIncome)}</strong>
          <small>{periodShort(netIncome)}</small>
        </article>
        <article>
          <span>Margem líquida</span>
          <strong>{formatSeriesValue(netMargin)}</strong>
          <small>{marginMovement(netMargin)}</small>
        </article>
        <article>
          <span>{isQuarterly ? "Crescimento a/a" : "ROE"}</span>
          <strong>{formatSeriesValue(isQuarterly ? revenueGrowth : roe)}</strong>
          <small>{periodShort(isQuarterly ? revenueGrowth : roe)}</small>
        </article>
      </section>

      <IndicatorDashboard
        ticker={ticker}
        summary={indicatorSummary}
        history={indicatorHistory}
        selectedSlug={indicatorHistory ? requestedIndicator : null}
        years={indicatorYears}
        chartMode={indicatorChart}
        pageFrequency={frequency}
      />

      <section className="overview-dashboard" id="leitura-rapida">
        <div className="dashboard-main">
          <div className="section-title-row">
            <div>
              <span className="eyebrow">LEITURAS RÁPIDAS</span>
              <h2>O que os números estão mostrando</h2>
            </div>
            <span className="data-source-pill">Base CVM</span>
          </div>

          <div className="insight-grid">
            <article className={`insight-card ${insightTone(growthValue)}`}>
              <span>Crescimento</span>
              <strong>{formatSeriesValue(revenueGrowth)}</strong>
              <p>
                {growthValue > 0
                  ? "A receita avançou na comparação anual do período mais recente."
                  : growthValue < 0
                    ? "A receita recuou na comparação anual do período mais recente."
                    : "Sem variação anual relevante disponível no período mais recente."}
              </p>
            </article>

            <article className="insight-card neutral">
              <span>Rentabilidade</span>
              <strong>{formatSeriesValue(netMargin)}</strong>
              <p>Margem líquida atual. {marginMovement(netMargin)}.</p>
            </article>

            <article className="insight-card neutral">
              <span>Endividamento</span>
              <strong>{formatSeriesValue(netDebt)}</strong>
              <p>Dívida líquida do fechamento mais recente, calculada apenas com componentes compatíveis.</p>
            </article>

            <article className={`insight-card ${insightTone(cashFlowValue)}`}>
              <span>Caixa operacional</span>
              <strong>{formatSeriesValue(operatingCashFlow)}</strong>
              <p>
                {cashFlowValue >= 0
                  ? "A operação gerou caixa no período apresentado."
                  : "A operação consumiu caixa no período apresentado."}
              </p>
            </article>
          </div>
        </div>

        <aside className="research-consensus-card">
          <div className="research-card-heading">
            <div>
              <span className="eyebrow">CASAS DE ANÁLISE</span>
              <h2>Consenso de analistas</h2>
            </div>
            <span className="research-status">planejado</span>
          </div>
          <p className="research-intro">
            O painel está preparado para recomendações de compra, manutenção e venda e para a faixa de preços-alvo.
          </p>
          <div className="recommendation-scale">
            <div><span>Compra</span><strong>—</strong></div>
            <div><span>Neutro</span><strong>—</strong></div>
            <div><span>Venda</span><strong>—</strong></div>
          </div>
          <div className="target-price-grid">
            <div><span>Mínimo</span><strong>—</strong></div>
            <div><span>Médio</span><strong>—</strong></div>
            <div><span>Máximo</span><strong>—</strong></div>
          </div>
          <small>
            Nenhum número é exibido até integrarmos uma fonte de recomendações com licença e metodologia adequadas.
          </small>
        </aside>
      </section>

      <section className="events-section" id="eventos">
        <div className="section-title-row">
          <div>
            <span className="eyebrow">EVENTOS E COMUNICADOS</span>
            <h2>Últimos documentos oficiais</h2>
          </div>
          <Link href={`/relatorios?ticker=${ticker}`}>Ver todos →</Link>
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

      <section className="asset-context-grid">
        <article className="panel financial-coverage">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">COBERTURA FINANCEIRA</span>
              <h2>Dados disponíveis</h2>
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
          <h2>Companhia e ativo</h2>
          <dl>
            <div><dt>CNPJ</dt><dd>{company?.cnpj ?? "—"}</dd></div>
            <div><dt>Código CVM</dt><dd>{company?.cvm_code ?? "—"}</dd></div>
            <div><dt>ISIN</dt><dd>{instrument.isin ?? "—"}</dd></div>
            <div><dt>Governança</dt><dd>{instrument.governance_level ?? "—"}</dd></div>
            <div><dt>Categoria</dt><dd>{instrument.security_category ?? "—"}</dd></div>
          </dl>
        </article>
      </section>

      <section className="series-section" id="financeiro">
        <div className="section-heading series-section-heading">
          <div>
            <span className="eyebrow">DEMONSTRAÇÕES FINANCEIRAS</span>
            <h2>{isQuarterly ? "Histórico trimestral" : "Histórico anual"}</h2>
          </div>
          <div className="series-heading-side">
            <div className="series-toggle" aria-label="Frequência das séries">
              <Link className={!isQuarterly ? "active" : ""} href={`/ativos/${ticker}#financeiro`}>
                Anual
              </Link>
              <Link
                className={isQuarterly ? "active" : ""}
                href={`/ativos/${ticker}?view=quarterly#financeiro`}
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

      <footer className="asset-sources">
        <strong>Proveniência</strong>
        <span>{sourceLabel(instrument.source)}</span>
        {company?.source && <span>{sourceLabel(company.source)}</span>}
      </footer>
    </main>
  );
}
