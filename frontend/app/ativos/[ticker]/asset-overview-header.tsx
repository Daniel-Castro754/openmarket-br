import Link from "next/link";

type SummaryMetric = {
  label: string;
  value: string;
  context: string;
  provenance?: string;
};

type Props = {
  ticker: string;
  title: string;
  legalName: string;
  exchange: string;
  securityCategory?: string | null;
  governanceLevel?: string | null;
  latestPeriodLabel: string;
  financialItemCount: number;
  availablePeriods: number;
  summaryMetrics: SummaryMetric[];
};

export function AssetOverviewHeader({
  ticker,
  title,
  legalName,
  exchange,
  securityCategory,
  governanceLevel,
  latestPeriodLabel,
  financialItemCount,
  availablePeriods,
  summaryMetrics,
}: Props) {
  const metadata = [securityCategory, governanceLevel].filter(Boolean) as string[];

  return (
    <>
      <section className="asset-hero-v2" id="visao-geral">
        <div className="asset-hero-identity">
          <div className="asset-hero-mark" aria-hidden="true">
            {ticker.slice(0, 2)}
          </div>

          <div className="asset-hero-copy">
            <div className="asset-hero-title-row">
              <h1>{ticker}</h1>
              <span className="asset-hero-exchange">{exchange}</span>
            </div>
            <strong className="asset-hero-name">{title}</strong>
            <p>{legalName}</p>

            <div className="asset-hero-metadata" aria-label="Metadados do ativo">
              {metadata.map((item) => (
                <span key={item}>{item}</span>
              ))}
              <span>Dados CVM</span>
            </div>
          </div>
        </div>

        <div className="asset-hero-side">
          <div className="asset-hero-actions" aria-label="Ações do ativo">
            <Link href={`/comparar?tickers=${ticker}`}>Comparar</Link>
            <Link href={`/relatorios?ticker=${ticker}`}>Relatórios</Link>
          </div>

          <aside className="asset-financial-context" aria-label="Cobertura financeira do ativo">
            <span className="asset-context-eyebrow">Último período financeiro</span>
            <strong>{latestPeriodLabel}</strong>
            <div className="asset-context-stats">
              <div>
                <span>Fatos</span>
                <b>{financialItemCount.toLocaleString("pt-BR")}</b>
              </div>
              <div>
                <span>Períodos</span>
                <b>{availablePeriods}</b>
              </div>
            </div>
            <small>Base financeira oficial e cálculos rastreáveis. Cotação ainda não integrada.</small>
            <a href="#financeiro">Ver demonstrativos →</a>
          </aside>
        </div>
      </section>

      <nav className="asset-tabs asset-tabs-v2" aria-label="Seções da ação">
        <a className="active" href="#visao-geral">Visão geral</a>
        <a href="#indicadores-fundamentais">Indicadores</a>
        <a href="#financeiro">Financeiro</a>
        <a href="#eventos">Eventos</a>
        <Link href={`/relatorios?ticker=${ticker}`}>Relatórios</Link>
      </nav>

      <section className="asset-summary-v2" aria-label="Indicadores em destaque">
        {summaryMetrics.map((metric) => (
          <article key={metric.label}>
            <div className="asset-summary-heading">
              <span>{metric.label}</span>
              {metric.provenance ? <small>{metric.provenance}</small> : null}
            </div>
            <strong>{metric.value}</strong>
            <p>{metric.context}</p>
          </article>
        ))}
      </section>
    </>
  );
}
