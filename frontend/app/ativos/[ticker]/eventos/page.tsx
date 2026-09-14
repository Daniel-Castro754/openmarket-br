import Link from "next/link";

import { getDocuments } from "../../../../lib/api";

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

export default async function AssetEventsPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.trim().toUpperCase();
  const documents = await getDocuments({ ticker, limit: 18 });

  return (
    <section className="asset-doc-workspace asset-events-workspace" id="eventos">
      <header className="asset-doc-header">
        <div className="asset-doc-header-copy">
          <span className="eyebrow">EVENTOS E COMUNICADOS</span>
          <h2>Publicações recentes de {ticker}</h2>
          <p>
            Linha do tempo de documentos sincronizados para o ativo, com tipo, data, período de referência e fonte.
          </p>
        </div>

        <div className="asset-doc-header-actions">
          <span className="asset-doc-source">Fonte oficial</span>
          <span className="asset-doc-count">{documents.length} publicações</span>
          <Link className="asset-doc-header-link" href={`/ativos/${ticker}/relatorios`}>
            Ver relatórios →
          </Link>
        </div>
      </header>

      <div className="asset-doc-list-shell">
        <div className="asset-doc-list-head" aria-hidden="true">
          <span>Publicação</span>
          <span>Documento</span>
          <span>Ação</span>
        </div>

        <div className="asset-doc-list">
          {documents.map((document) => (
            <Link className="asset-doc-row" href={`/relatorios/${document.id}`} key={document.id}>
              <div className="asset-doc-meta asset-event-marker">
                <span className="asset-doc-type">{documentTypeLabel(document.document_type)}</span>
                <span className="asset-doc-date">{formatDate(document.published_at)}</span>
              </div>

              <div className="asset-doc-main">
                <h3>{document.title}</h3>
                <div className="asset-doc-subline">
                  {document.reference_period ? <span>{document.reference_period}</span> : null}
                  <span>{document.source.source_name}</span>
                </div>
              </div>

              <div className="asset-doc-side">
                <span className="asset-doc-open">Abrir →</span>
              </div>
            </Link>
          ))}

          {documents.length === 0 ? (
            <div className="asset-doc-empty">Nenhuma publicação sincronizada para este ticker.</div>
          ) : null}
        </div>
      </div>

      <div className="asset-doc-note">
        <strong>Leitura da aba</strong>
        <span>Esta área prioriza a sequência temporal. Para explorar todos os arquivos e filtros, use Relatórios.</span>
      </div>
    </section>
  );
}
