import Link from "next/link";
import { notFound } from "next/navigation";

import { getAsset, SourceMetadata } from "../../../lib/api";

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

export default async function AssetPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.trim().toUpperCase();
  const asset = await getAsset(ticker);

  if (!asset) notFound();

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

      <section className="panel roadmap-panel">
        <div>
          <span className="eyebrow">PRÓXIMO BLOCO</span>
          <h2>Séries e gráficos</h2>
          <p>
            A base já conhece o ativo e os demonstrativos. O próximo módulo transforma esses fatos
            contábeis em séries comparáveis de receita, lucro, margens e endividamento.
          </p>
        </div>
        <Link className="text-link" href={`/api-placeholder/${ticker}`} aria-disabled="true">
          Em desenvolvimento
        </Link>
      </section>

      <footer className="asset-sources">
        <strong>Proveniência</strong>
        <span>{sourceLabel(instrument.source)}</span>
        {company?.source && <span>{sourceLabel(company.source)}</span>}
      </footer>
    </main>
  );
}
