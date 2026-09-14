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

function statusLabel(value: string) {
  if (value === "ready") return "Disponível";
  if (value === "processing") return "Processando";
  if (value === "failed") return "Falha";
  return value;
}

export default async function AssetReportsPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.trim().toUpperCase();
  const documents = await getDocuments({ ticker, limit: 30 });

  return (
    <section className="asset-doc-workspace asset-reports-workspace" id="relatorios">
      <header className="asset-doc-header">
        <div className="asset-doc-header-copy">
          <span className="eyebrow">DOCUMENTOS</span>
          <h2>Relatórios e arquivos oficiais de {ticker}</h2>
          <p>
            Explorador documental do ativo, com período de referência, processamento e acesso ao arquivo sincronizado.
          </p>
        </div>

        <div className="asset-doc-header-actions">
          <span className="asset-doc-source">CVM + fontes sincronizadas</span>
          <span className="asset-doc-count">{documents.length} arquivos</span>
          <Link className="asset-doc-header-link" href={`/relatorios?ticker=${ticker}`}>
            Abrir Document Hub →
          </Link>
        </div>
      </header>

      <div className="asset-doc-list-shell">
        <div className="asset-doc-list-head" aria-hidden="true">
          <span>Tipo / data</span>
          <span>Documento</span>
          <span>Status</span>
        </div>

        <div className="asset-doc-list">
          {documents.map((document) => {
            const ready = document.processing_status === "ready";
            return (
              <Link className="asset-doc-row" href={`/relatorios/${document.id}`} key={document.id}>
                <div className="asset-doc-meta">
                  <span className="asset-doc-type">{documentTypeLabel(document.document_type)}</span>
                  <span className="asset-doc-date">{formatDate(document.published_at)}</span>
                </div>

                <div className="asset-doc-main">
                  <h3>{document.title}</h3>
                  <div className="asset-doc-subline">
                    {document.reference_period ? <span>Referência: {document.reference_period}</span> : null}
                    <span>{document.source.source_name}</span>
                  </div>
                </div>

                <div className="asset-doc-side">
                  <span className={`asset-doc-status ${ready ? "asset-doc-status-ready" : ""}`}>
                    {statusLabel(document.processing_status)}
                  </span>
                  <span className="asset-doc-open">Abrir →</span>
                </div>
              </Link>
            );
          })}

          {documents.length === 0 ? (
            <div className="asset-doc-empty">Nenhum relatório sincronizado para este ticker.</div>
          ) : null}
        </div>
      </div>

      <div className="asset-doc-note">
        <strong>Mais filtros</strong>
        <span>O Document Hub oferece a exploração completa por ticker, tipo de documento e demais filtros disponíveis.</span>
      </div>
    </section>
  );
}
