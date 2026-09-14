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
    <section className="events-section" id="eventos">
      <div className="section-title-row">
        <div>
          <span className="eyebrow">EVENTOS E COMUNICADOS</span>
          <h2>Publicações recentes de {ticker}</h2>
        </div>
        <Link href={`/ativos/${ticker}/relatorios`}>Ver relatórios →</Link>
      </div>

      <div className="events-grid">
        {documents.map((document) => (
          <Link className="event-card" href={`/relatorios/${document.id}`} key={document.id}>
            <div>
              <span className="event-type">{documentTypeLabel(document.document_type)}</span>
              <span className="event-date">{formatDate(document.published_at)}</span>
            </div>
            <h3>{document.title}</h3>
            <small>
              {document.reference_period ? `${document.reference_period} · ` : ""}
              {document.source.source_name}
            </small>
          </Link>
        ))}
        {documents.length === 0 && (
          <div className="event-empty">Nenhuma publicação sincronizada para este ticker.</div>
        )}
      </div>
    </section>
  );
}
